import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { DOMParser } from '@xmldom/xmldom';
import { unzipSync, strFromU8, strToU8 } from 'fflate';
import { workbookXmlNormalizer } from './workbook-revision-xml';

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Google renumbers identical media between exports. Compare their contents and
 * resolved relationships, retaining placement, image bytes, cells and styles. */
export function workbookContentRevision(bytes: Uint8Array): string {
  const steps = workbookRevisionSteps(bytes);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

export async function abortableWorkbookContentRevision(bytes: Uint8Array, signal?: AbortSignal): Promise<string> {
  if (!signal) return workbookContentRevision(bytes);
  const steps = workbookRevisionSteps(bytes);
  // Give the deadline a chance to fire between ZIP/XML processing steps.
  for (;;) {
    await setImmediate(undefined, { signal });
    signal.throwIfAborted();
    const step = steps.next();
    if (step.done) return step.value;
  }
}

function* workbookRevisionSteps(bytes: Uint8Array): Generator<void, string> {
  const files = unzipSync(bytes);
  yield;
  const normalizeXml = workbookXmlNormalizer(files);
  yield;
  const media = new Map(Object.keys(files).filter(name => name.startsWith('xl/media/'))
    .map(name => [name, digest(files[name])]));
  const entries = Object.keys(files)
    .filter(name => !name.endsWith('/') && name !== 'docProps/core.xml')
    .map(name => ({ name, key: media.has(name) ? `media:${media.get(name)}` : name }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const hash = createHash('sha256');
  for (const { name, key } of entries) {
    const content = files[name];
    let normalized = content;
    if (!media.has(name) && (name.endsWith('.rels') || name.endsWith('.xml'))) {
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
    hash.update(JSON.stringify([key, normalized.byteLength]));
    hash.update(normalized);
    yield;
  }
  return `xlsx-v2:${hash.digest('hex')}`;
}
