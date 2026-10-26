import { Worker as NodeWorker } from 'node:worker_threads';

/** Run the exact browser worker script with only its browser messaging adapted. */
export class GifNodeWorker {
  static active = 0;
  static peak = 0;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  private thread?: NodeWorker;
  private ended = false;
  private ready: Promise<NodeWorker | undefined>;
  constructor(url: string | URL) {
    GifNodeWorker.active++; GifNodeWorker.peak = Math.max(GifNodeWorker.peak, GifNodeWorker.active);
    this.ready = fetch(String(url)).then(response => response.text()).then(source => {
      if (this.ended) return;
      const bridge = `const {parentPort}=require('node:worker_threads');var process=undefined;var onmessage;var postMessage=data=>parentPort.postMessage(data);globalThis.importScripts=()=>{};globalThis.self={location:{href:'http://localhost/gif-worker.js'}};const fetchData=globalThis.fetch;globalThis.fetch=(url,...args)=>{if(!String(url).startsWith('data:'))throw new Error('Unexpected network request');return fetchData(url,...args)};`;
      const thread = this.thread = new NodeWorker(`${bridge}\n${source}\nparentPort.on('message',data=>onmessage({data}));`, { eval: true });
      thread.on('message', data => this.onmessage?.({ data } as MessageEvent));
      thread.on('error', error => this.onerror?.({ message: error.message } as ErrorEvent));
      thread.on('messageerror', () => this.onmessageerror?.({} as MessageEvent));
      return thread;
    });
  }
  postMessage(message: unknown, transfer: ArrayBuffer[] = []) {
    void this.ready.then(thread => thread?.postMessage(message, transfer)).catch(reason => this.onerror?.({ message: String(reason) } as ErrorEvent));
  }
  terminate() {
    if (this.ended) return;
    this.ended = true; GifNodeWorker.active--; void this.thread?.terminate();
  }
}
