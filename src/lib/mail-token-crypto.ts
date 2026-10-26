import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(secret: string) {
  if (secret.length < 32) throw new Error("กรุณาตั้งค่า MAIL_TOKEN_ENCRYPTION_SECRET อย่างน้อย 32 ตัวอักษร");
  return createHash("sha256").update(secret).digest();
}
export function sealMailToken(value: unknown, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),ciphertext]).toString("base64url");
}
export function openMailToken(value: string, secret: string): unknown {
  const payload = Buffer.from(value,"base64url");
  if (payload.length < 29) throw new Error("Mail connection ไม่ถูกต้อง กรุณาเชื่อมใหม่");
  const decipher = createDecipheriv("aes-256-gcm",key(secret),payload.subarray(0,12));
  decipher.setAuthTag(payload.subarray(12,28));
  return JSON.parse(Buffer.concat([decipher.update(payload.subarray(28)),decipher.final()]).toString("utf8"));
}
