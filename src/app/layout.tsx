import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QA Result Workspace",
  description: "จัดการ Testcase ผลการทดสอบ และหลักฐานในที่เดียว",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
