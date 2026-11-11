export const sheetRevisionStreamType = 'application/vnd.qa.sheet-revision';

type RevisionFrame = { revision?: string; workbookLength?: number; status?: number; error?: string; authUrl?: string };
type RevisionSnapshot = { revision: string; workbook?: ArrayBuffer };
const newline = 10;

export function streamGoogleRevision(
  read: (signal: AbortSignal) => Promise<RevisionSnapshot>,
  failure: (reason: unknown) => Promise<RevisionFrame>,
  requestSignal: AbortSignal,
) {
  const disconnected = new AbortController();
  const signal = AbortSignal.any([disconnected.signal, requestSignal]);
  const encoder = new TextEncoder();
  const heartbeat = encoder.encode('\n');
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(heartbeat);
      const timer = setInterval(() => {
        if (!signal.aborted && (controller.desiredSize ?? 0) > 0) controller.enqueue(heartbeat);
      }, 5_000);
      const stop = () => clearInterval(timer);
      const abort = () => {
        stop();
        controller.error(signal.reason);
      };
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
      void (async () => {
        try {
          signal.throwIfAborted();
          let frame: RevisionFrame;
          let workbook: ArrayBuffer | undefined;
          try {
            const snapshot = await read(signal);
            workbook = snapshot.workbook;
            frame = { revision: snapshot.revision, workbookLength: workbook?.byteLength };
          } catch (reason) {
            if (signal.aborted) return;
            frame = await failure(reason);
          }
          if (signal.aborted) return;
          controller.enqueue(encoder.encode(JSON.stringify(frame) + '\n'));
          if (workbook) controller.enqueue(new Uint8Array(workbook));
          controller.close();
        } catch (reason) {
          if (!signal.aborted) controller.error(reason);
        } finally {
          stop();
          signal.removeEventListener('abort', abort);
        }
      })();
    },
    cancel() { disconnected.abort(); },
  });
  return new Response(stream, { headers: { 'Content-Type': sheetRevisionStreamType, 'Cache-Control': 'private, no-store, no-transform' } });
}

export async function readGoogleRevisionStream(response: Response) {
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let start = 0;
  while (bytes[start] === newline) start++;
  const end = bytes.indexOf(newline, start);
  if (end < 0) throw new Error('การตรวจข้อมูลล่าสุดจาก Sheets ถูกตัดก่อนเสร็จ กรุณาลองใหม่');
  const frame = JSON.parse(new TextDecoder().decode(bytes.subarray(start, end))) as RevisionFrame;
  const length = bytes.byteLength - end - 1;
  if (length !== (frame.workbookLength ?? 0)) throw new Error('โหลดไฟล์ต้นฉบับจาก Sheets ไม่ครบ กรุณาลองใหม่');
  return { frame, workbook: length ? buffer.slice(end + 1) : undefined };
}
