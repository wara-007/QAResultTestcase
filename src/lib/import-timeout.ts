export async function withImportTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, milliseconds: number, stage: string): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${stage} ใช้เวลานานเกินกำหนด กรุณาลองใหม่ ข้อมูลที่บันทึกแล้วจะยังอยู่`));
      controller.abort();
    }, milliseconds);
  });
  try { return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), timeout]); }
  finally { clearTimeout(timer!); }
}
