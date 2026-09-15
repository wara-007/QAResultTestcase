import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service | QA Result Workspace",
  description: "Terms of Service for QA Result Workspace.",
};

export default function TermsPage() {
  return <LegalPage title="Terms of Service" subtitle="Effective date: September 9, 2026">
    <section><h2>Acceptance</h2><p>By accessing QA Result Workspace, you agree to these terms and the Privacy Policy. If you do not agree, do not use the application.</p></section>
    <section><h2>Authorized use</h2><p>The application is intended for authorized quality-assurance work. Possession of an account does not automatically grant access to every group or project. System and group administrators determine application permissions.</p></section>
    <section><h2>User responsibilities</h2><p>You are responsible for the accuracy and appropriateness of information you add, for protecting your account, and for ensuring that uploaded files, logs, API responses, screenshots, Jira links, and other evidence may lawfully be used by your team. Do not upload malicious content or information you are not authorized to process.</p></section>
    <section><h2>Third-party services</h2><p>Supabase, Cloudflare R2, Google Sheets, and legacy Google Drive storage remain subject to their applicable terms and policies. Revoking a connected Google account may disable spreadsheet synchronization while leaving application Login available.</p></section>
    <section><h2>Availability and changes</h2><p>The service may be updated, suspended, or changed to maintain security, reliability, or functionality. Features that depend on third-party services may be unavailable when those services are interrupted or their policies change.</p></section>
    <section><h2>Termination</h2><p>Administrators may remove a user&apos;s access when it is no longer required or when these terms are violated. Users may stop using the service and request deletion of application-managed data through the contact below.</p></section>
    <section><h2>Contact</h2><p>For questions about these terms, contact <a href="mailto:warawut_pum@truecorp.co.th">warawut_pum@truecorp.co.th</a>.</p></section>
  </LegalPage>;
}
