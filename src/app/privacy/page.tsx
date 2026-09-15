import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | QA Result Workspace",
  description: "Privacy Policy for QA Result Workspace and its use of Google user data.",
};

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" subtitle="Effective date: September 9, 2026">
    <section><h2>Overview</h2><p>QA Result Workspace helps authorized quality-assurance teams manage projects, test cases, test results, defects, supporting files, and evidence. This policy explains what data the application uses and why.</p></section>
    <section><h2>Information we collect</h2><p>When you sign in, we process your email address, account identifier, access role, and available profile information. The application also stores information that authorized users enter, including group membership, projects, test cases, test results, defects, notes, device details, application versions, logs, API responses, and related metadata.</p></section>
    <section><h2>Google API data</h2><p>The application requests access to Google Sheets only when an authorized QA user connects the integration to read or update a spreadsheet linked to a project. Legacy evidence may remain in Google Drive. The application uses this data only to provide features initiated by an authorized user.</p><p>QA Result Workspace&apos;s use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.</p></section>
    <section><h2>How information is used</h2><p>Information is used to authenticate users, enforce access permissions, display shared QA workspaces, preserve testing records, synchronize linked spreadsheets, upload and preview evidence, and maintain the reliability and security of the service.</p></section>
    <section><h2>Storage and sharing</h2><p>Application data may be processed by service providers used to operate the system, including Supabase, Cloudflare R2, Google APIs, and the hosting provider. Evidence images stored in R2 use a public read URL so they can be previewed in the application and rendered in linked Google Sheets. Service credentials are protected and are not exposed to users. We do not sell user data or use it for advertising.</p></section>
    <section><h2>Data retention and deletion</h2><p>Project data and evidence are retained while needed by the QA team or until an authorized administrator deletes them. Legacy files stored in a user&apos;s Google Drive remain subject to that user&apos;s Google Drive controls. Users may revoke the application&apos;s Google access from their Google Account permissions page.</p></section>
    <section><h2>Access and security</h2><p>Access to groups and projects is controlled by application roles. Users must not share access credentials or intentionally access information outside their assigned work. No online service can guarantee absolute security, but reasonable controls are used to reduce unauthorized access.</p></section>
    <section><h2>Contact</h2><p>For privacy questions or requests to access or delete application data, contact <a href="mailto:warawut_pum@truecorp.co.th">warawut_pum@truecorp.co.th</a>.</p></section>
  </LegalPage>;
}
