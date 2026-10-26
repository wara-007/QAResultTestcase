import nodemailer from "nodemailer";
import type { buildApprovalEmail } from "./approval-email";

// MIME generation only: no SMTP connection or App Password is used.
export async function encodeGmailMessage(message: ReturnType<typeof buildApprovalEmail>) {
  const mime = await nodemailer.createTransport({streamTransport: true, buffer: true, newline: "windows", disableFileAccess: true, disableUrlAccess: true}).sendMail(message);
  if (!Buffer.isBuffer(mime.message)) throw new Error("Could not encode Gmail message");
  return mime.message.toString("base64url");
}
