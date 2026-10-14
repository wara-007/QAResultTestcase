export const PICKER_WORKBOOK_MIMES = "application/vnd.google-apps.spreadsheet,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function pickerConfiguration(env: Record<string, string | undefined>) {
  const developerKey = env.GOOGLE_PICKER_API_KEY?.trim();
  const appId = env.GOOGLE_CLOUD_PROJECT_NUMBER?.trim();
  if (!developerKey) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_PICKER_API_KEY สำหรับเลือกไฟล์จาก Google Drive");
  if (!appId || !/^\d+$/.test(appId)) throw new Error("กรุณาตั้งค่า GOOGLE_CLOUD_PROJECT_NUMBER เป็น Project number ของ Google Cloud โปรเจคเดียวกับ OAuth");
  return { developerKey, appId };
}

export type PickedWorkbook = { id: string; name: string; url: string };
export type PickerSelection = { action?: string; docs?: Array<{ id?: string; name?: string; mimeType?: string; url?: string }> };
export function pickedWorkbook(selection: PickerSelection, expectedFileId?: string): PickedWorkbook | null {
  if (selection.action !== "picked") return null;
  const doc = selection.docs?.[0];
  if (!doc?.id || !/^[a-zA-Z0-9_-]+$/.test(doc.id) || !PICKER_WORKBOOK_MIMES.split(",").includes(doc.mimeType ?? "")) throw new Error("รองรับ Google Sheets และ Excel .xlsx เท่านั้น");
  if (expectedFileId && doc.id !== expectedFileId) throw new Error("กรุณาเลือกไฟล์ที่เชื่อมกับ Project นี้ หากต้องการเปลี่ยนไฟล์ให้ไปที่ตั้งค่า Project");
  return { id: doc.id, name: doc.name ?? "Workbook", url: `https://docs.google.com/spreadsheets/d/${encodeURIComponent(doc.id)}/edit` };
}
