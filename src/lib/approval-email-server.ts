import "server-only";
import nodemailer from "nodemailer";
import { gmailSmtpOptions } from "./approval-email";

// Validate configuration before reserving an approval; never expose secrets to the client.
export function createApprovalMailTransport() {
  return nodemailer.createTransport(gmailSmtpOptions({ GMAIL_USER: process.env.GMAIL_USER, GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD }));
}
