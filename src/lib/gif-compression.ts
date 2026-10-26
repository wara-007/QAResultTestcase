import type { CompressedImage } from './image-compression';
import { GIF_MAX_BYTES } from './evidence-media';
import { readGifMetadata, sameGifAnimation } from './gif-metadata';

const MIN_GIF_BYTES = 64 * 1024;
const MAX_GIF_PIXELS = 8 * 1024 * 1024;
const TIMEOUT_MS = 30_000;
let queued: Promise<unknown> = Promise.resolve();
let engine: Promise<string> | undefined;

function optimize(input: ArrayBuffer): Promise<Uint8Array | undefined> {
  return new Promise(resolve => {
    let worker: Worker | undefined, url: string | undefined, settled = false;
    const finish = (bytes?: Uint8Array) => {
      if (settled) return;
      settled = true; clearTimeout(timeout);
      if (worker) { worker.onmessage = worker.onerror = worker.onmessageerror = null; worker.terminate(); }
      if (url) URL.revokeObjectURL(url);
      resolve(bytes);
    };
    const timeout = setTimeout(() => finish(), TIMEOUT_MS);
    void (async () => {
      // The pinned package embeds its entire WASM runtime in this worker source.
      // Own the worker so deadlines terminate CPU work, not just its Promise.
      engine ??= import('gifsicle-wasm-browser').then(module => module.default.tool.workerLocalUrl).catch(reason => { engine = undefined; throw reason; });
      const source = await engine;
      if (settled) return;
      if (typeof source !== 'string' || !source.length) return finish();
      url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      worker = new Worker(url);
      worker.onmessage = event => {
        const output = event.data;
        finish(Array.isArray(output) && output.length === 1 && output[0]?.file instanceof Uint8Array ? output[0].file : undefined);
      };
      worker.onerror = event => { event.preventDefault?.(); finish(); };
      worker.onmessageerror = () => finish();
      worker.postMessage({ data: [{ name: 'input.gif', file: input }], command: ['-O1 -Okeep-empty --conserve-memory input.gif -o /out/optimized.gif'], folder: [], isStrict: true }, [input]);
    })().catch(() => finish());
  });
}

/** Lossless, serialized and best-effort. The caller always keeps a usable file. */
export function compressEvidenceGif(file: File): Promise<CompressedImage> {
  const original = { file, originalBytes: file.size, compressed: false };
  if (file.type !== 'image/gif' || file.size < MIN_GIF_BYTES || file.size > GIF_MAX_BYTES
    || typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') return Promise.resolve(original);
  const job = queued.then(async () => {
    try {
      const input = await file.arrayBuffer();
      const before = readGifMetadata(new Uint8Array(input));
      if (!before || before.width * before.height > MAX_GIF_PIXELS) return original;
      const bytes = await optimize(input);
      if (!bytes?.byteLength || bytes.byteLength >= file.size) return original;
      const after = readGifMetadata(bytes);
      if (!after || !sameGifAnimation(before, after)) return original;
      return { file: new File([new Uint8Array(bytes)], file.name, { type: 'image/gif', lastModified: file.lastModified }), originalBytes: file.size, compressed: true };
    } catch { return original; }
  });
  queued = job.then(() => {}, () => {});
  return job;
}
