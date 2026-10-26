import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import { unzipSync, strFromU8, strToU8 } from 'fflate';
import { workbookXmlNormalizer } from './workbook-revision-xml';

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Google renumbers identical media between exports. Compare their contents and
 * resolved relationships, retaining placement, image bytes, cells and styles. */
export function workbookContentRevision(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const normalizeXml = workbookXmlNormalizer(files);
  const media = new Map(Object.keys(files).filter(name => name.startsWith('xl/media/'))
    .map(name => [name, digest(files[name])]));
  const entries: [string, Uint8Array][] = [];
  for (const [name, content] of Object.entries(files)) {
    if (name.endsWith('/') || name === 'docProps/core.xml') continue;
    if (media.has(name)) {
      entries.push([`media:${media.get(name)}`, content]);
      continue;
    }
    let normalized = content;
    if (name.endsWith('.rels') || name.endsWith('.xml')) {
      const doc = new DOMParser().parseFromString(strFromU8(content), 'application/xml');
      if (name.endsWith('.rels')) {
        const owner = name.replace(/(^|\/)\_rels\//, '$1').replace(/\.rels$/, '');
        for (const relation of Array.from(doc.getElementsByTagNameNS('*', 'Relationship'))) {
          if (relation.getAttribute('TargetMode') === 'External') continue;
          const target = relation.getAttribute('Target') ?? '';
          const path = target.startsWith('/') ? target.slice(1) : posix.normalize(posix.join(posix.dirname(owner), target));
          if (media.has(path)) relation.setAttribute('Target', `media:${media.get(path)}`);
        }
      } else if (/^xl\/drawings\/[^/]+\.xml$/.test(name)) {
        for (const properties of Array.from(doc.getElementsByTagNameNS('*', 'cNvPr'))) {
          if (properties.parentNode?.localName === 'nvPicPr') properties.removeAttribute('name');
        }
      }
      normalized = strToU8(normalizeXml(doc, name));
    }
    entries.push([name, normalized]);
  }
  entries.sort(([a], [b]) => a.localeCompare(b));
  const hash = createHash('sha256');
  for (const [name, content] of entries) {
    hash.update(JSON.stringify([name, content.byteLength]));
    hash.update(content);
  }
  return `xlsx-v2:${hash.digest('hex')}`;
}
