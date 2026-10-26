export const ACCESS_CHECK_UNAVAILABLE = 'ตรวจสอบสิทธิ์ไม่สำเร็จ ระบบเชื่อมต่อฐานข้อมูลไม่ได้ชั่วคราว กรุณาลองอีกครั้ง';
export const SIGN_IN_UNAVAILABLE = 'เชื่อมต่อระบบเข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง';

export function isMissingRoleFunction(error: {code?:string}|null) {
  return error?.code === 'PGRST202' || error?.code === '42883';
}
export function isTemporaryAuthFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value=error as {status?:number;name?:string;message?:string;code?:string};
  return value.status === 0 || (value.status ?? 0) >= 500 || value.name === 'AuthRetryableFetchError'
    || /timeout|timed out|fetch failed|network|connection|temporarily unavailable/i.test(value.message ?? '')
    || ['57014','PGRST000','PGRST001','PGRST002','PGRST003'].includes(value.code ?? '');
}
