export class WorkbookRevisionError extends Error {}

export async function revisionCheckedWorkbook(expected: string, readRevision:()=>Promise<string>, download:()=>Promise<ArrayBuffer>, revisionFromBytes?:(bytes:ArrayBuffer)=>string) {
 const message='Sheets มีการเปลี่ยนแปลง กรุณาอัปเดตข้อมูลจาก Sheets ก่อนลองอีกครั้ง';
 if (!expected) throw new WorkbookRevisionError(message);
 if (expected.startsWith('xlsx-v2:') && revisionFromBytes) {
  const bytes=await download();
  if (revisionFromBytes(bytes)!==expected) throw new WorkbookRevisionError(message);
  return bytes;
 }
 if (await readRevision()!==expected) throw new WorkbookRevisionError(message);
 const bytes=await download();
 if (await readRevision()!==expected) throw new WorkbookRevisionError(message);
 return bytes;
}
