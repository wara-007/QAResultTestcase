import { createHash } from 'node:crypto';
import { DOMParser, type Document, type Element, type Node } from '@xmldom/xmldom';
import { strFromU8 } from 'fflate';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const children = (node: Node): Element[] => Array.from(node.childNodes).filter(child => child.nodeType === 1) as Element[];
type AttributeResolver = (element: Element, name: string, value: string) => string;

/** Namespace prefixes and attribute order are serialization details. Text and
 * rich-text attributes remain part of the signature. */
function canonical(node: Node, resolve: AttributeResolver, sharedStrings?: string[]): unknown {
  if (node.nodeType !== 1) return [node.nodeType, node.nodeValue];
  const element = node as Element;
  const attributes = Array.from(element.attributes).filter(attribute => attribute.namespaceURI !== 'http://www.w3.org/2000/xmlns/' && attribute.name !== 'xmlns')
    .map(attribute => [`${attribute.namespaceURI ?? ''}:${attribute.localName ?? attribute.name}`, resolve(element, attribute.localName ?? attribute.name, attribute.value)]);
  const spreadsheet = !element.namespaceURI || element.namespaceURI === 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const defaults = spreadsheet && element.localName === 'c' ? ['s']
    : spreadsheet && element.localName === 'col' ? ['style']
    : spreadsheet && element.localName === 'xf' ? ['fontId', 'fillId', 'borderId', 'numFmtId', ...(element.parentNode?.localName === 'cellXfs' ? ['xfId'] : [])] : [];
  for (const name of defaults) if (!element.hasAttribute(name)) attributes.push([`:${name}`, resolve(element, name, '0')]);
  attributes.sort(([left], [right]) => left.localeCompare(right));
  const parent = element.parentNode as Element | null;
  const stringIndex = element.localName === 'v' && parent?.localName === 'c' && parent.getAttribute('t') === 's'
    ? Number(element.textContent) : undefined;
  const content = stringIndex !== undefined && sharedStrings?.[stringIndex] !== undefined
    ? [['shared-string', sharedStrings[stringIndex]]]
    : Array.from(element.childNodes).map(child => canonical(child, resolve, sharedStrings));
  return [element.namespaceURI ?? '', element.localName ?? element.nodeName, attributes, content];
}

/** Resolve the indexed dictionaries that Google is free to reorder per export.
 * The hashes are for comparison only; no workbook bytes are modified. */
export function workbookXmlNormalizer(files: Record<string, Uint8Array>) {
  const parse = (bytes: Uint8Array) => {
    const doc = new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');
    if (!doc.documentElement) throw new Error('Workbook XML has no document element');
    return doc as Document & { documentElement: Element };
  };
  const styles = files['xl/styles.xml'] ? parse(files['xl/styles.xml']) : undefined;
  const tables = new Map<string, Element[]>();
  const tableKinds: Record<string, string> = { fonts: 'fontId', fills: 'fillId', borders: 'borderId', cellStyleXfs: 'xfId', cellXfs: 'cellStyle', dxfs: 'dxfId' };
  for (const table of styles ? children(styles.documentElement) : []) {
    const kind = tableKinds[table.localName ?? table.nodeName];
    if (kind) tables.set(kind, children(table));
  }
  const numberFormats = new Map<string, string>();
  for (const format of Array.from(styles?.getElementsByTagNameNS('*', 'numFmt') ?? [])) {
    if (format.parentNode?.localName === 'numFmts') numberFormats.set(format.getAttribute('numFmtId') ?? '', format.getAttribute('formatCode') ?? '');
  }
  const cache = new Map<string, string>();
  const resolving = new Set<string>();
  const definition = (kind: string, index: string): string => {
    if (kind === 'numFmtId') return numberFormats.has(index) ? `custom:${numberFormats.get(index)}` : `builtin:${index}`;
    const key = `${kind}:${index}`;
    if (cache.has(key)) return cache.get(key)!;
    const entry = tables.get(kind)?.[Number(index)];
    if (!entry) return `unresolved:${key}`;
    if (resolving.has(key)) throw new Error('Workbook style references contain a cycle');
    resolving.add(key);
    const value = hash(JSON.stringify(canonical(entry, resolve)));
    resolving.delete(key);
    cache.set(key, value);
    return value;
  };
  const resolve: AttributeResolver = (element, name, value) => {
    // These IDs refer to dictionaries in styles.xml, including row/column and
    // conditional formatting. Other numeric attributes retain their values.
    if (['fontId', 'fillId', 'borderId', 'xfId', 'dxfId', 'numFmtId'].includes(name)) return definition(name, value);
    if ((name === 's' && ['c', 'row'].includes(element.localName ?? element.nodeName)) || (name === 'style' && element.localName === 'col')) return definition('cellStyle', value);
    return value;
  };
  const strings = files['xl/sharedStrings.xml'] ? children(parse(files['xl/sharedStrings.xml']).documentElement)
    .map(item => hash(JSON.stringify(canonical(item, resolve)))) : [];
  return (doc: Document, path: string): string => {
    const root = doc.documentElement;
    if (!root) throw new Error('Workbook XML has no document element');
    if (path === 'xl/sharedStrings.xml') return JSON.stringify([...new Set(strings)].sort());
    if (path === 'xl/styles.xml') {
      const parts = children(root).map(table => {
        const kind = tableKinds[table.localName ?? table.nodeName];
        if (kind) return [table.localName, [...new Set(children(table).map((_, index) => definition(kind, String(index))))].sort()];
        if (table.localName === 'numFmts') return ['numFmts', [...new Set(numberFormats.values())].sort()];
        return canonical(table, resolve);
      });
      return JSON.stringify(parts);
    }
    // Global style indices apply to SpreadsheetML, not DrawingML font IDs.
    const spreadsheet = /^(?:xl\/worksheets\/|xl\/tables\/)/.test(path);
    return JSON.stringify(canonical(root, spreadsheet ? resolve : (_element, _name, value) => value, spreadsheet ? strings : undefined));
  };
}
