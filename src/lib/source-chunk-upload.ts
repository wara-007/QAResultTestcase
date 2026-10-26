type UploadFailure = { message?: string; statusCode?: string | number; status?: number; error?: string };
type ChunkStorage = {
  upload: (path: string, chunk: Blob) => Promise<{ error: UploadFailure | null }>;
  download: (path: string) => Promise<{ data: Blob | null; error: UploadFailure | null }>;
  wait?: (milliseconds: number) => Promise<void>;
};
const status = (error: UploadFailure) => Number(error.statusCode ?? error.status);
const transient = (error: UploadFailure) => [408, 429].includes(status(error)) || status(error) >= 500
  || (!status(error) && /failed to fetch|fetch failed|network|load failed|timed?\s*out|timeout/i.test(error.message ?? ''));
const duplicate = (error: UploadFailure) => status(error) === 409 || /already exists|duplicate/i.test(`${error.error ?? ''} ${error.message ?? ''}`);

async function identicalBytes(left: Blob, right: Blob): Promise<boolean> {
  if (left.size !== right.size) return false;
  const [a, b] = await Promise.all([left.arrayBuffer(), right.arrayBuffer()]);
  const first = new Uint8Array(a), second = new Uint8Array(b);
  return first.every((byte, index) => byte === second[index]);
}

/** Keep a part's path and bytes stable through retries. INSERT-only storage
 * policies remain sufficient: an ambiguous committed upload is verified, never
 * overwritten or accepted merely because the path exists. */
export async function uploadSourceChunks(file: Blob, chunkSize: number, storageKey: string, storage: ChunkStorage): Promise<number> {
  if (!file.size || !Number.isSafeInteger(chunkSize) || chunkSize <= 0) throw new Error('ไฟล์ต้นฉบับไม่ถูกต้อง');
  const count = Math.ceil(file.size / chunkSize);
  const wait = storage.wait ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  for (let index = 0; index < count; index++) {
    const chunk = file.slice(index * chunkSize, Math.min((index + 1) * chunkSize, file.size));
    const path = `${storageKey}/part-${String(index).padStart(3, '0')}`;
    for (let attempt = 0; ; attempt++) {
      let error: UploadFailure | null;
      try { error = (await storage.upload(path, chunk)).error; }
      catch (reason) { error = reason instanceof Error ? reason : { message: String(reason) }; }
      if (!error) break;
      if (attempt > 0 && duplicate(error)) {
        let stored: Awaited<ReturnType<ChunkStorage['download']>>;
        try { stored = await storage.download(path); }
        catch (reason) { stored = { data: null, error: reason instanceof Error ? reason : { message: String(reason) } }; }
        if (!stored.error && stored.data) {
          if (await identicalBytes(chunk, stored.data)) break;
          throw new Error(`ไฟล์ต้นฉบับส่วนที่ ${index + 1}/${count} ไม่ตรงกับข้อมูลที่ส่ง`);
        }
        error = stored.error ?? { message: 'ตรวจไฟล์ที่อัปโหลดไม่สำเร็จ' };
      }
      if (attempt >= 2 || !transient(error)) throw new Error(`อัปโหลดไฟล์ต้นฉบับส่วนที่ ${index + 1}/${count} ไม่สำเร็จ: ${error.message ?? 'Unknown upload error'}`);
      await wait((attempt + 1) * 500);
    }
  }
  return count;
}
