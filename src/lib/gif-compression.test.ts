import assert from 'node:assert/strict';
import test from 'node:test';
import { compressEvidenceImage } from './image-compression';
import { animatedGifFixture } from './test-fixtures/animated-gif';
import { GifNodeWorker } from './test-fixtures/gif-node-worker';
import { readGifMetadata, sameGifAnimation } from './gif-metadata';

function browserWorker(context: import('node:test').TestContext, worker: unknown = GifNodeWorker) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { configurable: true, writable: true, value: worker });
  context.after(() => { if (original) Object.defineProperty(globalThis, 'Worker', original); else Reflect.deleteProperty(globalThis, 'Worker'); });
}
test('the upload compressor losslessly optimizes animated GIFs and preserves the evidence filename', async context => {
  browserWorker(context);
  const file = new File([animatedGifFixture()], 'sheet-proof-original-evidence.gif', { type: 'image/gif', lastModified: 1234 });
  const result = await compressEvidenceImage(file);
  assert.equal(result.compressed, true);
  assert.ok(result.file.size < file.size);
  assert.equal(result.originalBytes, file.size);
  assert.equal(result.file.type, 'image/gif');
  assert.equal(result.file.name, file.name);
  assert.equal(result.file.lastModified, file.lastModified);
  assert.deepEqual(readGifMetadata(new Uint8Array(await result.file.arrayBuffer())), readGifMetadata(new Uint8Array(await file.arrayBuffer())));
  assert.equal(GifNodeWorker.active, 0);
});

test('concurrent GIF imports use one optimizer worker at a time', async context => {
  browserWorker(context); GifNodeWorker.peak = 0;
  const files = ['a','b','c'].map(name => new File([animatedGifFixture()], `${name}.gif`, { type: 'image/gif' }));
  const results = await Promise.all(files.map(compressEvidenceImage));
  assert.ok(results.every(result => result.compressed));
  assert.equal(GifNodeWorker.peak, 1); assert.equal(GifNodeWorker.active, 0);
});
test('transparent GIFs with retained, cleared and restored frames keep their animation', async context => {
  browserWorker(context);
  for (const disposal of [1,2,3]) {
    const bytes=animatedGifFixture({transparent:true,disposal});
    const file=new File([bytes],`transparent-${disposal}.gif`,{type:'image/gif'});
    const result=await compressEvidenceImage(file);
    assert.equal(result.compressed,true);
    assert.deepEqual(readGifMetadata(new Uint8Array(await result.file.arrayBuffer())),readGifMetadata(bytes));
  }
});

class OutputWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  static output: Uint8Array | undefined;
  static disposed = 0;
  postMessage(message: { data: { file: ArrayBuffer }[] }) {
    queueMicrotask(() => this.onmessage?.({ data: [{ file: OutputWorker.output ?? new Uint8Array(message.data[0].file) }] } as MessageEvent));
  }
  terminate() { OutputWorker.disposed++; }
}
test('unchanged, larger and invalid optimizer output retain the exact original file', async context => {
  browserWorker(context, OutputWorker);
  const file = new File([animatedGifFixture()], 'proof.gif', { type: 'image/gif' });
  for (const output of [undefined, new Uint8Array(file.size + 1), new Uint8Array([1,2,3])]) {
    OutputWorker.output = output;
    const result = await compressEvidenceImage(file);
    assert.equal(result.compressed, false); assert.equal(result.file, file);
  }
});
test('an optimizer cannot change frame count, delays, dimensions or looping', async context => {
  browserWorker(context, OutputWorker);
  const file = new File([animatedGifFixture({ commentBytes: 8192 })], 'proof.gif', { type: 'image/gif' });
  for (const options of [{delays:[10,20]}, {delays:[11,20,30,40]}, {width:128}, {loopCount:0}]) {
    OutputWorker.output = animatedGifFixture(options);
    const result = await compressEvidenceImage(file);
    assert.equal(result.compressed, false); assert.equal(result.file, file);
  }
});
test('worker startup failures use the original without rejecting the upload', async context => {
  browserWorker(context, class { constructor() { throw new Error('Worker unavailable'); } });
  const file = new File([animatedGifFixture()], 'proof.gif', { type: 'image/gif' });
  assert.equal((await compressEvidenceImage(file)).file, file);
});
test('a stalled worker is terminated and its object URL is released at the deadline', async context => {
  class StalledWorker extends OutputWorker { postMessage() {} }
  browserWorker(context, StalledWorker); OutputWorker.disposed = 0;
  const originalTimer = setTimeout;
  context.mock.method(globalThis, 'setTimeout', ((callback: () => void, delay: number) => originalTimer(callback, Math.min(delay, 10))) as typeof setTimeout);
  const revoke = URL.revokeObjectURL; const released: string[] = [];
  context.mock.method(URL, 'revokeObjectURL', (url: string) => { released.push(url); revoke(url); });
  const file = new File([animatedGifFixture()], 'proof.gif', { type: 'image/gif' });
  assert.equal((await compressEvidenceImage(file)).file, file);
  assert.equal(OutputWorker.disposed, 1); assert.equal(released.length, 1);
});
test('tiny, malformed, oversized and excessively large canvases skip GIF optimization safely', async context => {
  browserWorker(context, class { constructor() { throw new Error('Must not need a worker'); } });
  const malformed = new Uint8Array(70 * 1024); malformed.set(new TextEncoder().encode('GIF89a'));
  const hugeCanvas = animatedGifFixture({ width:1, height:1, commentBytes:70*1024 }); hugeCanvas[6]=255; hugeCanvas[7]=255; hugeCanvas[8]=255; hugeCanvas[9]=255;
  for (const bytes of [animatedGifFixture({width:2,height:2}), malformed, new Uint8Array(25*1024*1024+1), hugeCanvas]) {
    const file = new File([bytes], 'proof.gif', { type:'image/gif' });
    assert.equal((await compressEvidenceImage(file)).file, file);
  }
});
test('metadata inspection rejects truncation and distinguishes animation timing', () => {
  const bytes = animatedGifFixture({width:32,height:32,delays:[0,2,19],loopCount:0});
  assert.deepEqual(readGifMetadata(bytes), {width:32,height:32,delays:[0,2,19],loopCount:0});
  for (const length of [0,10,24,bytes.length-1]) assert.equal(readGifMetadata(bytes.subarray(0,length)), undefined);
  const metadata=readGifMetadata(bytes)!;
  assert.equal(sameGifAnimation(metadata,{...metadata,loopCount:null}),false);
  assert.equal(sameGifAnimation(metadata,{...metadata,delays:[0,3,19]}),false);
});
