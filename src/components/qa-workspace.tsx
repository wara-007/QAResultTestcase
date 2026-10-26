"use client";
import { revisionBoundSource, revisionBoundCheckpoint } from "@/lib/revision-bound-source";
import { canRenderStoredCaseDetails } from "@/lib/source-workbook-storage";
import { alignRegisterCaseIdentities, displayTestCaseId } from "@/lib/register-case-identity";

import { prioritizeReferencedSheets, unreferencedSnapshotAssignments } from "../lib/register-result-references";
import { SprintProjectList } from './sprint-project-list';
import type { SprintDashboardData } from '../lib/sprint-dashboard';
import { GlobalProjectSearch } from './global-project-search';
import { ProjectBreadcrumb } from './project-breadcrumb';
import { ProjectEvidenceProgress } from './project-evidence-progress';

import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  FileArchive,
  FileSpreadsheet,
  Filter,
  FolderKanban,
  LayoutDashboard,
  LoaderCircle,
  Mail,
  Menu,
  MoreHorizontal,
  Search,
  Send,
  Settings,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Link2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useEffectEvent, useMemo, useReducer, useRef, useState, useTransition } from "react";
import { CaseTableTools } from './case-table-tools';
import { CaseRegisterTable, type CaseRegisterRow } from './case-register-table';
import { useCaseTableView } from './use-case-table-view';
import { CASE_ADVANCED_FILTERS_ENABLED, collectCaseColumns, filterCaseTable, visibleCaseColumns } from '@/lib/case-table-view';
import { assignmentModeReducer, isAssignmentEditing } from '@/lib/case-assignment-mode';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleCleanupWarning } from './google-cleanup-warning';
import { createProject, createProjectApprovalRequest, deleteProject, getLatestProjectApproval, getApprovalMailConnection, updateProjectGoogleSheet, type ProjectApprovalSummary } from "@/app/actions";
import { mailConnectUrl, mailProvider, mailProviderLabel, mailDeliveryLabel, type MailConnection } from "@/lib/mail-provider";
import { GoogleDrivePickerButton } from "@/components/google-drive-picker-button";
import { ProjectFileActions } from "@/components/project-file-actions";
import { googleAuthorizationTarget } from "@/lib/google-authorization";
import { signOut } from "@/app/auth/actions";
import { exportTestCases, importTestCases, readWorkbookFreeformResults, readWorkbookResultImages, readWorkbookSheet } from "@/lib/excel-ooxml";
import { evidenceImageUrl } from "@/lib/evidence";
import { ImageViewerGallery } from "@/components/image-viewer-gallery";
import { ResultTextViewer } from "@/components/result-text-viewer";
import { SheetResultSections } from "@/components/sheet-result-sections";
import { isSheetPayloadLabel } from "@/lib/sheet-sections";
import { ResultActualText } from "./result-actual-text";
import { batchRowLoader, sheetRowState, caseDetailLoadKeys, canReuseSheetDetails, completeResultTabLoad, isImportedEvidenceDisplayed, unrepresentedResultSheets, type RowLoadState } from "@/lib/result-preview";
import { runSheetEvidenceImports, runSheetTextImports, sheetImportProgressLabel, sheetImportAction, type SheetImportProgress } from "@/lib/sheet-import-progress";
import { withImportTimeout } from "@/lib/import-timeout";
import { workspaceReadyFirst, shouldFetchGoogleWorkspace } from "@/lib/workspace-loading";
import { selectDetailSheets } from "@/lib/sheet-detail";
import { collectProjectDefects, isProjectDefectSheet, summarizeProjectDefects } from "@/lib/project-defects";
import { ProjectManagement } from "@/components/project-management";
import { approvalDraftBody, isApprovalDraft } from "@/lib/approval-draft";
import { workspaceEnvironment } from "@/lib/workspace-environment";
import { approvalEvidenceReadiness, importedEvidenceKey } from "@/lib/approval-evidence";
import { evidenceUploadBatch, sharedEvidenceFiles } from "@/lib/evidence-upload-batch";
import { waitForProjectDetailWrites, beginProjectDetailRefresh, completeProjectDetailWrites, projectDetailRefreshPending } from "@/lib/project-detail-lock";
import { TestCaseAssignmentDialog, type AssignmentData } from './test-case-assignment-dialog';
import { getTestCaseAssignments } from '@/app/planning-actions';
import type { Sprint } from "@/lib/types";
import { SheetMappingControl } from "@/components/sheet-mapping-control";
import { SyncConflictDialog } from "@/components/sync-conflict-dialog";
import { formatFlexibleDate } from "@/lib/date-format";
import { compressEvidenceImage } from "@/lib/image-compression";
import { compressEvidenceVideo } from "@/lib/video-compression";
import { EVIDENCE_ACCEPT, validateEvidenceFile } from "@/lib/evidence-media";
import { loadProjectWorkbook, loadProjectWorkspace, persistImportedWorkbook, persistTestCaseResult, persistSheetImportState } from "@/lib/project-data";
import { automaticSheetImportMode, withWorkbookDefinitions, withSavedCaseIdentity, sheetImportRevisionStatus, sheetRefreshRequired, registerBaseline, refreshRegisterCases } from "@/lib/sheet-refresh";
import { checkpointSheetImport, readSheetImportState, pendingImportSheets, initialSheetImportStates } from "@/lib/sheet-import-state";
import { filterProjects } from "@/lib/project-search";
import { resolveSheetAssociations } from "@/lib/sheet-mapping-resolution";
import { workspaceCasesForRegister } from "@/lib/sheet-register-cases";
import { clearProjectWorkbook, getProjectWorkbook } from "@/lib/workbook-cache";
import { detectBootstrapCaseConflicts, detectThreeWayCaseConflicts, mergeCaseChoices, type CaseChoice, type CaseConflict } from "@/lib/sync/client-conflicts";
import type { CanonicalProjectSnapshot } from "@/lib/sync/types";
import { mergeWorkspaceAndGoogleCases, scopeGoogleDetailCases } from "@/lib/sync/workspace-merge";
import { workbookResultFallback, refreshWorkbookStepEvidence } from "@/lib/workbook-step-refresh";
import { TestCaseSteps, orderedStepResults, stepResultTitle } from "./test-case-steps";
import { TestCaseSourceDetails } from "./test-case-source-details";
import { aggregateStepStatus } from "@/lib/step-testcases";
import { WorkbookSummary } from "./workbook-summary";
import { needsStepTemplateRefresh } from "@/lib/step-reconciliation";
import { refreshCaseDraft } from "@/lib/case-draft-refresh";
import { SharedSheetDefinition } from "./shared-sheet-definition";
import { ResultStepMapping } from "./result-step-mapping";
import { TEST_STATUSES, type CurrentUser, type Project, type ProjectSheetMapping, type TestCase, type TestCaseResultField, type TestDefect, type TestEvidence, type TestResult, type TestStatus, type WorkbookSheet, type WorkbookSheetContent, type WorkbookSource } from "@/lib/types";

const statusMeta: Record<TestStatus, { label: string; className: string }> = {
  "Not Start": { label: "Not Start", className: "status-not-start" },
  "In Progress": { label: "Inprogress", className: "status-in-progress" },
  Pass: { label: "Pass", className: "status-pass" },
  Failed: { label: "Failed", className: "status-failed" },
  Skip: { label: "Skip", className: "status-skip" },
};

function withPassedTimestamp(testCase: TestCase): TestCase {
  if (testCase.status !== "Pass" || (testCase.executedDate && testCase.executedTime)) return testCase;
  const passedAt = testCase.results?.find((result) => result.status === "Pass")?.createdAt;
  const timestamp = passedAt && !Number.isNaN(Date.parse(passedAt)) ? new Date(passedAt) : new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(timestamp).map((part) => [part.type, part.value]));
  return { ...testCase, executedDate: `${parts.day}/${parts.month}/${parts.year}`, executedTime: `${parts.hour}:${parts.minute}:${parts.second}` };
}

export const PROJECT_PAGES = ["overview", "test-cases", "defects", "files", "settings"] as const;
export type ProjectPageName = (typeof PROJECT_PAGES)[number];

type WorkspacePage = "projects" | ProjectPageName;
type WorkspaceNavigationCache = {
  cases: TestCase[];
  source: WorkbookSource | null;
  sheetMappings: ProjectSheetMapping[];
  hasLoadedSheetMappings: boolean;
  hasUnsyncedChanges: boolean;
  hasDetailedGoogleData: boolean;
  hasGoogleWorkbook: boolean;
  sheetRowLoads: Record<string, RowLoadState>;
  sheetLoadProgress?: Record<string, SheetImportProgress>;
};
const workspaceNavigationCache = new Map<string, WorkspaceNavigationCache>();
const activeProjectImports = new Set<string>();

async function cacheProjectDefectMetadata(projectId: string, sheets: WorkbookSheet[]) {
  const { response, data } = await withImportTimeout(async signal => {
    const response = await fetch(`/api/projects/${projectId}/google-sheet`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sheets }), signal });
    return { response, data: await response.json() };
  }, 60_000, "บันทึกข้อมูล Defects ของ Project");
  if (!response.ok) throw new Error(data.error ?? "บันทึก Defects สำหรับ Sprint ไม่สำเร็จ");
}

function continueGoogleAuthorization(authUrl: string, manual = false) {
  const current = new URL(window.location.href);
  if (manual) {
    current.searchParams.delete("googleAuthAttempt");
    current.searchParams.delete("googleAuthError");
    current.searchParams.delete("googleAuth");
  }
  const target = googleAuthorizationTarget(authUrl, window.location.origin, `${current.pathname}${current.search}${current.hash}`);
  if (!target) throw new Error("ยังไม่ได้รับสิทธิ์ Google ที่จำเป็น กรุณาลองเชื่อม Google ใหม่ — ระบบหยุดขอสิทธิ์อัตโนมัติเพื่อไม่ให้เด้งวน");
  window.location.assign(target);
}

function testCaseIdentity(value: string) {
  const match = value.trim().match(/^(?:TC|TEST\s*CASE|TESTCASE|CASE)[\s:_-]*(\d+)$/i);
  return match ? `TC-${Number(match[1])}` : value.trim().toUpperCase();
}

function testResultIdentity(result: Pick<TestResult, "id" | "sourceSheetName">) {
  return `${result.sourceSheetName ?? "web"}:${result.id}`;
}

const resultRecordFieldLabels = new Set([
  "platform", "env", "environment", "device", "app version", "version",
  "executed by", "tester", "test data", "data test", "remark", "note", "notes",
  "actual result", "result", "test result", "status", "executed date", "test date",
  "executed time", "test time", "api response", "log", "evidence", "evidence images",
  "attachments", "แพลตฟอร์ม", "สภาพแวดล้อม", "อุปกรณ์", "เวอร์ชันแอป", "ผู้ทดสอบ",
  "ข้อมูลทดสอบ", "หมายเหตุ", "ผลที่พบ", "ผลการทดสอบ", "สถานะผลทดสอบ",
  "วันที่ทดสอบ", "เวลาทดสอบ", "หลักฐาน",
]);

function normalizeFieldLabel(label: string) {
  return label.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function isResultRecordField(label: string) {
  return resultRecordFieldLabels.has(normalizeFieldLabel(label));
}

function testCaseIdsFromSheet(sheet: WorkbookSheet) {
  const ids = Array.from(sheet.name.matchAll(/\b(?:TC|TEST\s*CASE|TESTCASE|CASE)[\s:_-]*(\d+)/gi), (match) => `TC-${Number(match[1])}`);
  return ids.length ? [...new Set(ids)] : sheet.testCaseIds;
}

function mergeGoogleSheetsWithSource(sourceSheets: WorkbookSheet[], googleSheets: WorkbookSheet[]) {
  const sourceByName = new Map(sourceSheets.map((sheet) => [sheet.name.trim().toLowerCase(), sheet]));
  return googleSheets.map((googleSheet) => {
    const sourceSheet = sourceByName.get(googleSheet.name.trim().toLowerCase());
    if (!sourceSheet) return googleSheet;
    return {
      ...googleSheet,
      path: sourceSheet.path,
      imageCount: sourceSheet.imageCount,
      defects: googleSheet.defects ?? sourceSheet.defects,
      // Keep the live Google metadata. The uploaded workbook can be stale and
      // previously caused newly added/non-TC tabs to disappear from the UI.
      kind: googleSheet.kind,
      testCaseIds: googleSheet.testCaseIds,
    };
  });
}

function evidenceViewerImages(evidence: TestEvidence[]) {
  return evidence.filter((item) => /^(image|video)\//.test(item.mimeType)).map((item) => ({
    id: `${item.fileId}-${item.name}`,
    name: item.name,
    url: evidenceImageUrl(item),
    mimeType: item.mimeType,
  }));
}

function StatusBadge({ status }: { status: TestStatus }) {
  const meta = statusMeta[status];
  return <span className={`status-badge ${meta.className}`}><span />{meta.label}</span>;
}

function StatCard({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: number | string; detail: string; tone: string }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function UploadDialog({ onClose, onImported }: { onClose: () => void; onImported: (cases: TestCase[], source: WorkbookSource) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("รองรับเฉพาะไฟล์ .xlsx เท่านั้น");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const buffer = await file.arrayBuffer();
      const result = importTestCases(buffer, file.name);
      await onImported(result.cases, result.source);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "อ่านไฟล์ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="upload-dialog" role="dialog" aria-modal="true" aria-labelledby="upload-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button close-button" onClick={onClose} aria-label="ปิด"><X size={19} /></button>
        <div className="dialog-heading">
          <div className="dialog-icon"><FileSpreadsheet size={24} /></div>
          <div><p className="eyebrow">IMPORT TESTCASE</p><h2 id="upload-title">อัปโหลดไฟล์ Excel</h2></div>
        </div>
        <div
          className={`dropzone ${dragging ? "dragging" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); void handleFile(event.dataTransfer.files[0]); }}
        >
          {busy ? <LoaderCircle className="spin" size={34} /> : <Upload size={34} />}
          <strong>{busy ? "กำลังอ่านโครงสร้าง workbook..." : "ลากไฟล์มาวางที่นี่"}</strong>
          <span>ระบบจะค้นหาชีต Testcase และตรวจหา column mapping อัตโนมัติ</span>
          <button className="secondary-button" onClick={() => inputRef.current?.click()} disabled={busy}>เลือกไฟล์จากเครื่อง</button>
          <input ref={inputRef} type="file" accept=".xlsx" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => void handleFile(event.target.files?.[0])} />
        </div>
        {error && <p className="form-error"><CircleAlert size={16} />{error}</p>}
        <div className="privacy-note"><ShieldCheck size={17} /><span>ไฟล์ต้นฉบับและ Testcase จะถูกบันทึกใน Supabase ของ Project นี้</span></div>
      </section>
    </div>
  );
}

function CreateTestCaseDialog({ existingIds, nextSourceRow, defaultEnvironment, currentUserName, onClose, onCreated }: {
  existingIds: string[];
  nextSourceRow: number;
  defaultEnvironment: string;
  currentUserName: string;
  onClose: () => void;
  onCreated: (testCase: TestCase) => Promise<void>;
}) {
  const [draft, setDraft] = useState({ id: "", scenario: "", name: "", steps: "", expected: "", platform: "", condition: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function update(field: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = draft.id.trim();
    if (!id || !draft.name.trim() || !draft.steps.trim() || !draft.expected.trim()) {
      setError("กรุณากรอก Test Case ID, ชื่อ Test Case, Test Step และ Expected Result");
      return;
    }
    if (existingIds.some((existingId) => existingId.toUpperCase() === id.toUpperCase())) {
      setError(`มี Test Case ID ${id} อยู่แล้ว`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onCreated({
        id,
        sourceRow: nextSourceRow,
        platform: draft.platform.trim(),
        condition: draft.condition.trim(),
        scenario: draft.scenario.trim(),
        name: draft.name.trim(),
        steps: draft.steps.trim(),
        expected: draft.expected.trim(),
        status: "Not Start",
        device: "",
        testData: "",
        appVersion: "",
        environment: defaultEnvironment,
        resultReference: "",
        executedBy: currentUserName,
        executedDate: "",
        executedTime: "",
        remark: "",
        evidence: [],
        results: [],
        defects: [],
      });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "เพิ่ม Test Case ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="upload-dialog testcase-create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-testcase-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button close-button" onClick={onClose} aria-label="ปิด"><X size={19} /></button>
        <div className="dialog-heading"><div className="dialog-icon"><ClipboardCheck size={24} /></div><div><p className="eyebrow">NEW TEST CASE</p><h2 id="create-testcase-title">เพิ่ม Test Case</h2></div></div>
        <form onSubmit={submit}>
          <div className="two-column-fields">
            <label><span>Test Case ID *</span><input value={draft.id} onChange={(event) => update("id", event.target.value)} placeholder="เช่น TC-21" autoFocus /></label>
            <label><span>Platform</span><input value={draft.platform} onChange={(event) => update("platform", event.target.value)} placeholder="เช่น App หรือ Web" /></label>
          </div>
          <label className="text-field"><span>Test Scenario</span><textarea rows={2} value={draft.scenario} onChange={(event) => update("scenario", event.target.value)} /></label>
          <label className="text-field"><span>Test Case Name *</span><input value={draft.name} onChange={(event) => update("name", event.target.value)} /></label>
          <label className="text-field"><span>Condition</span><textarea rows={2} value={draft.condition} onChange={(event) => update("condition", event.target.value)} /></label>
          <label className="text-field"><span>Test Step Description *</span><textarea rows={5} value={draft.steps} onChange={(event) => update("steps", event.target.value)} placeholder="ใส่แต่ละขั้นตอนแยกบรรทัด" /></label>
          <label className="text-field"><span>Expected Result *</span><textarea rows={5} value={draft.expected} onChange={(event) => update("expected", event.target.value)} placeholder="ใส่ผลลัพธ์ที่คาดหวัง" /></label>
          {error && <p className="form-error"><CircleAlert size={16} />{error}</p>}
          <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={busy}>ยกเลิก</button><button type="submit" className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}บันทึก Test Case</button></div>
        </form>
      </section>
    </div>
  );
}

function SetupView() {
  return (
    <main className="auth-screen">
      <section className="auth-card setup-card">
        <div className="auth-icon"><Settings size={26} /></div>
        <p className="eyebrow">SUPABASE SETUP</p>
        <h1>เชื่อมฐานข้อมูลก่อนเริ่มใช้งาน</h1>
        <p>ระบบไม่ใช้ข้อมูลจำลอง กรุณาใส่ Project URL และ Publishable key ที่คัดลอกจาก Supabase Connect dialog ลงใน <code>.env.local</code></p>
        <pre>NEXT_PUBLIC_SUPABASE_URL=...{"\n"}NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...</pre>
        <span>จากนั้นรัน migration ในโฟลเดอร์ <code>supabase/migrations</code> และ restart dev server</span>
      </section>
    </main>
  );
}

type ProjectDraft = { name: string; description: string; environment: string; googleSheetUrl: string; resume: boolean };
function ProjectDialog({ groupId, sprint, draft, draftKey, onClose, onCreated }: { groupId: string; sprint?: Sprint; draft: ProjectDraft | null; draftKey: string; onClose: () => void; onCreated: (project: Project) => void }) {
  const [sourceType, setSourceType] = useState<"file" | "url">(draft ? "url" : "file");
  const [name, setName] = useState(draft?.name ?? "");
  const [description, setDescription] = useState(draft?.description ?? "");
  const sprintNo = sprint?.name ?? "";
  const [environment, setEnvironment] = useState(draft?.environment ?? "UAT");
  const [googleSheetUrl, setGoogleSheetUrl] = useState(draft?.googleSheetUrl ?? "");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !draft) return;
    resumed.current = true;
    const query = new URLSearchParams(window.location.search);
    if (query.has("googleAuthError")) {
      queueMicrotask(() => setError("ไม่ได้อนุญาตสิทธิ์ Google ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง"));
    } else if (query.get("googleAuth") === "connected" && draft.resume) {
      formRef.current?.requestSubmit();
    }
  }, [draft]);

  function saveDraft(resume: boolean) {
    sessionStorage.setItem(draftKey, JSON.stringify({ name, description, environment, googleSheetUrl, resume }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Explicit retry is allowed; automatic callback retries keep their marker.
    if ((event.nativeEvent as SubmitEvent).submitter) {
      const url = new URL(window.location.href);
      url.searchParams.delete("googleAuthAttempt");
      url.searchParams.delete("googleAuthError");
      url.searchParams.delete("googleAuth");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    setError("");
    startTransition(async () => {
      try {
        const imported = sourceType === "file"
          ? excelFile ? importTestCases(await excelFile.arrayBuffer(), excelFile.name) : null
          : null;
        if (sourceType === "file" && !imported) return setError("กรุณาเลือกไฟล์ Excel");
        const result = await createProject({ groupId, name, description, sprintNo, sprintId: sprint?.id, environment, googleSheetUrl: sourceType === "url" ? googleSheetUrl : "" });
        if (!result.project && result.authUrl) {
          saveDraft(true);
          continueGoogleAuthorization(result.authUrl);
          return;
        }
        if (!result.project) return setError(result.error ?? "เพิ่ม Project ไม่สำเร็จ");
        if (imported) await persistImportedWorkbook(result.project.id, imported.cases, imported.source, true);
        sessionStorage.removeItem(draftKey);
        onCreated({ ...result.project, year: sprint?.year });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "เพิ่ม Project ไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form ref={formRef} className="project-dialog" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="icon-button close-button" onClick={onClose} aria-label="ปิด"><X size={19} /></button>
        <div className="dialog-heading"><div className="dialog-icon"><FolderKanban size={24} /></div><div><p className="eyebrow">NEW PROJECT</p><h2>เพิ่ม Project</h2></div></div>
        <div className="project-source-tabs" role="tablist" aria-label="แหล่งข้อมูล Testcase">
          <button type="button" role="tab" aria-selected={sourceType === "file"} className={sourceType === "file" ? "active" : ""} onClick={() => setSourceType("file")}><Upload size={16} />อัปโหลด Excel</button>
          <button type="button" role="tab" aria-selected={sourceType === "url"} className={sourceType === "url" ? "active" : ""} onClick={() => setSourceType("url")}><Link2 size={16} />Google Sheets URL</button>
        </div>
        <label className="text-field"><span>ชื่อ Project *</span><input autoFocus required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} placeholder="เช่น IR Cross sell" /></label>
        <label className="text-field"><span>รายละเอียด</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="ขอบเขตหรือเป้าหมายการทดสอบ" /></label>
        {sourceType === "file" ? <label className="project-file-picker"><Upload size={20} /><span><strong>{excelFile?.name ?? "เลือกไฟล์ Excel"}</strong><small>{excelFile ? `${(excelFile.size / 1024 / 1024).toFixed(2)} MB` : "รองรับไฟล์ .xlsx ที่มีชีต Testcase"}</small></span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setExcelFile(event.target.files?.[0] ?? null)} /></label>
          : <><label className="text-field"><span>Google Sheets / Excel บน Drive URL *</span><input required value={googleSheetUrl} onChange={(event) => setGoogleSheetUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." /></label><GoogleDrivePickerButton disabled={pending} onAuthorizationRequired={authUrl => { saveDraft(false); continueGoogleAuthorization(authUrl); }} onPicked={file => { setGoogleSheetUrl(file.url); if (!name.trim()) setName(file.name.replace(/\.xlsx$/i, "")); }} /><p className="dialog-help">ไฟล์ Excel บน Drive ต้องเลือกผ่านปุ่มนี้ เพื่ออนุญาตให้แอปอ่านเฉพาะไฟล์ที่เลือก</p></>}
        <div className="two-column-fields">
          <label><span>ปี / Sprint</span><input value={`${sprint?.year ?? ""} · ${sprintNo}`} readOnly /></label>
          <label><span>Environment *</span><input required value={environment} onChange={(event) => setEnvironment(event.target.value)} placeholder="UAT" /></label>
        </div>
        {error && <p className="form-error"><CircleAlert size={16} />{error}</p>}
        <footer className="dialog-footer"><button type="button" className="secondary-button" onClick={onClose}>ยกเลิก</button><button className="primary-button" disabled={pending}>{pending && <LoaderCircle className="spin" size={17} />}{pending ? "กำลังสร้าง..." : "เพิ่ม Project"}</button></footer>
      </form>
    </div>
  );
}

function GoogleSheetDialog({ project, onClose, onConnected }: { project: Project; onClose: () => void; onConnected: (project: Project) => void }) {
  const [url, setUrl] = useState(project.googleSheetUrl);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateProjectGoogleSheet(project.id, url);
      if ("error" in result) return setError(result.error ?? "เชื่อม Google Sheet ไม่สำเร็จ");
      onConnected({ ...project, ...result });
    });
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><form className="project-dialog" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
    <button type="button" className="icon-button close-button" onClick={onClose} aria-label="ปิด"><X size={19} /></button>
    <div className="dialog-heading"><div className="dialog-icon"><Link2 size={23} /></div><div><p className="eyebrow">GOOGLE SHEETS</p><h2>เชื่อม Google Sheet</h2></div></div>
    <label className="text-field"><span>Google Sheet URL *</span><input required autoFocus value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." /></label>
    <GoogleDrivePickerButton projectId={project.id} disabled={pending} onPicked={file => { setUrl(file.url); setError(""); }} />
    <p className="dialog-help">เลือก Google Sheets หรือ Excel .xlsx เพื่ออนุญาตไฟล์นี้ให้แอป แล้วกดเชื่อม Sheet โดยไฟล์ต้นฉบับจะไม่ถูกแปลงหรือลบ</p>
    {error && <p className="form-error"><CircleAlert size={16} />{error}</p>}
    <footer className="dialog-footer"><button type="button" className="secondary-button" onClick={onClose}>ยกเลิก</button><button className="primary-button" disabled={pending}>{pending && <LoaderCircle className="spin" size={17} />}เชื่อม Sheet</button></footer>
  </form></div>;
}

function ProjectsHome({ projects, error, onAdd, projectHref, canCreate, onUpdated }: { projects: Project[]; error: string; onAdd: () => void; projectHref: (project: Project) => string; canCreate: boolean; onUpdated: (project: Project) => void }) {
  const [projectSearch, setProjectSearch] = useState("");
  const [managedId, setManagedId] = useState<string | null>(null);
  const managed = projects.find((p) => p.id === managedId);
  const visibleProjects = useMemo(() => filterProjects(projects, projectSearch), [projectSearch, projects]);
  const hasQuery = Boolean(projectSearch.trim());
  return (
    <div className="projects-home" id="projects">
      <section className="projects-heading"><div><p className="eyebrow">WORKSPACE</p><h1>Projects</h1><span>เลือก Project เพื่อดู Testcase และผลทดสอบ</span></div>{canCreate && <button className="primary-button" onClick={onAdd}><PlusIcon />เพิ่ม Project</button>}</section>
      {!error && projects.length > 0 && <section className="project-search-bar"><label><Search size={18} /><input value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder="ค้นหาชื่อ Project, Environment, Sprint หรือ Google Sheets" aria-label="ค้นหา Projects" />{hasQuery && <button type="button" onClick={() => setProjectSearch("")} aria-label="ล้างการค้นหา"><X size={16} /></button>}</label><span>{hasQuery ? `พบ ${visibleProjects.length} จาก ${projects.length} Projects` : `${projects.length} Projects`}</span></section>}
      {error ? <section className="project-error"><CircleAlert size={20} /><div><strong>โหลด Projects ไม่สำเร็จ</strong><span>{error}</span></div></section> : visibleProjects.length ? <section className="panel project-row-list"><div className="project-list-header"><span>Project</span><span>Environment</span><span>ปี / Sprint</span><span>สร้างเมื่อ</span><span>จัดการ</span></div>{visibleProjects.map((project) => <article className="project-list-row" key={project.id}><Link className="project-row-title" href={projectHref(project)}><FolderKanban size={19} /><div><strong>{project.name}</strong><small>{project.description || "ไม่มีรายละเอียด"}</small>{!project.canEdit && <span className="read-only-card-pill">ดูอย่างเดียว</span>}</div></Link><span>{project.environment}</span><span>{project.year} · {project.sprintNo}</span><time>{formatFlexibleDate(project.createdAt, false)}</time><button className="secondary-button" onClick={() => setManagedId(project.id)}>{project.canManage ? "แก้ไข / ย้าย" : "ประวัติ"}</button></article>)}</section> : projects.length && hasQuery ? <section className="panel project-zero project-search-empty"><Search size={34} /><h2>ไม่พบ Project</h2><p>ไม่พบ Project ที่ตรงกับ “{projectSearch.trim()}”</p><button className="secondary-button" onClick={() => setProjectSearch("")}>ล้างการค้นหา</button></section> : <section className="panel project-zero"><FolderKanban size={34} /><h2>ยังไม่มี Project</h2><p>สร้าง Project แรกเพื่ออัปโหลด Testcase และเริ่มบันทึกผล</p>{canCreate && <button className="primary-button" onClick={onAdd}><PlusIcon />เพิ่ม Project</button>}</section>}
      {managed && <div className="modal-backdrop"><div className="project-dialog project-management-dialog"><button className="icon-button close-button" onClick={() => setManagedId(null)} aria-label="ปิด"><X size={18} /></button><ProjectManagement key={managed.id} project={managed} onSaved={(project) => { onUpdated(project); }} /></div></div>}
    </div>
  );
}

function ProjectApprovalPanel({ project, cases, counts, testingFinished, loading, currentEnvironment, currentUser, canSubmit, onConnectSheet, flash, evidenceReady, evidenceNotice, preparingEvidence, onPrepareEvidence, evidenceProgressVisible }: {
  project: Project;
  cases: TestCase[];
  counts: Record<TestStatus, number>;
  testingFinished: boolean;
  loading: boolean;
  currentEnvironment?: string;
  currentUser: CurrentUser | null;
  canSubmit: boolean;
  onConnectSheet: () => void;
  flash: (message: string) => void;
  evidenceReady: boolean;
  evidenceNotice: string;
  preparingEvidence: boolean;
  onPrepareEvidence: () => Promise<void>;
  evidenceProgressVisible?: boolean;
}) {
  const draftKey = `qa-approval-draft:${currentUser?.id ?? ""}:${project.id}`;
  const saved = useMemo(() => {
    try {
      const draft = JSON.parse(window.sessionStorage.getItem(draftKey) ?? "null");
      if (isApprovalDraft(draft)) return draft;
      return JSON.parse(window.localStorage.getItem(`qa-approval-email:${project.id}`) ?? "{}") as { poEmail?: string; cc?: string; subject?: string; body?: string };
    }
    catch { return {}; }
  }, [project.id, draftKey]);
  const [poEmail, setPoEmail] = useState(saved.poEmail ?? "");
  const [ccEmail, setCcEmail] = useState(saved.cc ?? "");
  const [emailSubject, setEmailSubject] = useState(saved.subject ?? `[QA Approval] ${project.name}`);
  const [editedEmailBody, setEmailBody] = useState<string | null>(saved.body ?? null);
  const emailBody = approvalDraftBody(editedEmailBody, { projectName: project.name,
    environment: currentEnvironment || project.environment, totalCases: cases.length, counts });
  const [mailConnection, setMailConnection] = useState<MailConnection | null>(null);
  const [mailNotice, setMailNotice] = useState("");
  const [showUntestedConfirmation, setShowUntestedConfirmation] = useState(false);
  const [approval, setApproval] = useState<ProjectApprovalSummary | null>(null);
  const [sendingApproval, setSendingApproval] = useState(false);
  const untested = counts["Not Start"] + counts["In Progress"];

  useEffect(() => {
    if (!canSubmit) return;
    let active = true;
    void getApprovalMailConnection(project.id).then(result => {
      if (!active) return;
      setMailConnection("email" in result ? result : {email: currentUser?.email ?? "", provider: mailProvider(currentUser?.email ?? ""), configured: true, connected: false, error: result.error});
      const query = new URLSearchParams(window.location.search);
      setMailNotice(query.get("mailAuthError") ?? query.get("gmailAuthError") ?? (query.has("mailAuth") || query.has("gmailAuth") ? "เชื่อมบัญชีส่งเมลแล้ว กรุณาตรวจร่างและกดส่งอีเมลอีกครั้ง" : ""));
    }).catch(() => { if (active) setMailConnection({email: currentUser?.email ?? "", provider: mailProvider(currentUser?.email ?? ""), configured: true, connected: false, error: "โหลดสถานะส่งเมลไม่สำเร็จ กรุณาโหลดหน้าใหม่"}); });
    return () => { active = false; };
  }, [project.id, canSubmit, currentUser?.email]);

  const senderProvider = mailConnection?.provider ?? mailProvider(currentUser?.email ?? "");
  const senderProviderLabel = mailProviderLabel(senderProvider);

  function connectMail() {
    if (!senderProvider) return flash("รองรับบัญชี QA @gmail.com และ @truecorp.co.th สำหรับส่งเมล");
    if (mailConnection?.configured === false) return flash(mailConnection.error || "กรุณาให้ผู้ดูแลตั้งค่าระบบส่งเมลก่อน");
    try { window.sessionStorage.setItem(draftKey, JSON.stringify({poEmail, cc: ccEmail, subject: emailSubject, body: editedEmailBody})); }
    catch { return flash("เก็บร่างอีเมลไม่ได้ กรุณาคัดลอกร่างไว้และอนุญาต Session Storage ก่อนเชื่อมบัญชีเมล"); }
    const current = new URL(window.location.href);
    window.location.assign(mailConnectUrl(senderProvider, `${current.pathname}${current.search}${current.hash}`));
  }

  useEffect(() => {
    let active = true;
    const refresh = () => void getLatestProjectApproval(project.id).then((result) => {
      if (!active || "error" in result) return;
      setApproval(result.approval);
    });
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [project.id]);

  function openApprovalEmail() {
    if (loading || sendingApproval) return;
    if (!evidenceReady || preparingEvidence) return flash("กรุณานำเข้ารายละเอียดและรูปหลักฐานทั้งโปรเจคให้เสร็จก่อนส่งให้ PO");
    const recipient = poEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(recipient)) return flash("กรุณากรอกอีเมล PO ให้ถูกต้อง");
    if (!project.googleSheetUrl) return flash("กรุณาเชื่อม Google Sheet ก่อนส่งขอ Approve");
    if (!mailConnection?.connected) { connectMail(); return; }
    if (!testingFinished) {
      setShowUntestedConfirmation(true);
      return;
    }
    void launchApprovalEmail();
  }

  async function launchApprovalEmail() {
    if (sendingApproval) return;
    if (!evidenceReady || preparingEvidence) return flash("หลักฐานยังไม่พร้อมส่ง กรุณานำเข้าทั้งโปรเจคให้เสร็จก่อน");
    const recipient = poEmail.trim();
    setShowUntestedConfirmation(false);
    setSendingApproval(true);
    try {
      const created = await createProjectApprovalRequest({
        projectId: project.id,
        recipientEmail: recipient,
        cc: ccEmail.trim(),
        subject: emailSubject,
        body: emailBody,
        note: "",
        environment: currentEnvironment || project.environment,
        counts: { total: cases.length, pass: counts.Pass, failed: counts.Failed, skip: counts.Skip, notStart: counts["Not Start"], inProgress: counts["In Progress"] },
      });
      if (!("request" in created)) {
        if (created.authUrl) { connectMail(); return; }
        flash(created.error ?? "สร้างลิงก์รีวิวไม่สำเร็จ");
        const latest = await getLatestProjectApproval(project.id);
        if ("approval" in latest) setApproval(latest.approval);
        return;
      }
      setApproval(created.request);
      try { window.localStorage.setItem(`qa-approval-email:${project.id}`, JSON.stringify({ poEmail: recipient })); } catch { /* Browser storage must not change the delivery outcome. */ }
      try { window.sessionStorage.removeItem(draftKey); } catch { /* Delivery already succeeded. */ }
      flash(created.warning ?? `${senderProviderLabel} รับคำขอส่งแล้ว กรุณาตรวจ Sent เพื่อดูเมลที่ส่ง`);
    } catch {
      flash("ยังยืนยันผลการส่งไม่ได้ กรุณาตรวจ Sent ของบัญชี QA ก่อนส่งซ้ำ");
    } finally {
      setSendingApproval(false);
    }
  }

  const approvalLabel = approval?.status === "approved" ? "Approved" : approval?.status === "changes_requested" ? "ขอให้แก้ไข" : approval?.status === "pending" ? "รอ PO รีวิว" : "";
  const approvalMatchesRecipient = approval?.recipientEmail === poEmail.trim().toLowerCase();

  return <><section className="panel approval-panel">
    {canSubmit && !evidenceProgressVisible && <section className="approval-evidence-status" aria-label="ความพร้อมของรูปหลักฐาน"><p role="status"><strong>{preparingEvidence ? "กำลังนำเข้ารายละเอียดและรูปหลักฐานทั้งโปรเจค…" : evidenceNotice}</strong></p><p>ระบบต้องอัปโหลดและบันทึกรูปครบก่อนส่งให้ PO โดยไม่ต้องเปิด Test case ทีละรายการ</p>{!evidenceReady && project.googleSheetId && <button type="button" className="secondary-button" disabled={loading || preparingEvidence || sendingApproval} onClick={() => void onPrepareEvidence()}>{preparingEvidence ? "กำลังนำเข้าหลักฐาน…" : "นำเข้าข้อมูลจาก Sheets"}</button>}</section>}
    <div className="approval-heading"><div className="approval-icon"><Mail size={23} /></div><div><h2>ส่งผลทดสอบให้ PO Approve</h2><p>ส่งจากอีเมล QA ที่เข้าสู่ระบบถึงผู้รับที่ระบุ พร้อมสรุปผลและลิงก์รีวิว · PO กด Reply ในเมลเพื่อตอบกลับ QA ได้</p></div><span className={`approval-readiness ${testingFinished && evidenceReady ? "ready" : "pending"}`}>{loading ? "กำลังโหลด..." : !evidenceReady ? "หลักฐานยังไม่พร้อม" : testingFinished ? "พร้อมส่ง" : cases.length ? `ยังไม่ได้ทดสอบ ${untested} cases` : "ยังไม่มี Test Case"}</span></div>
    {canSubmit && <div className="approval-form"><label className="text-field"><span>ผู้ส่ง (บัญชี QA)</span><input type="email" value={mailConnection?.email || currentUser?.email || ""} readOnly /><small>{!mailConnection ? "กำลังตรวจสิทธิ์ส่งเมล…" : mailConnection.connected ? `เชื่อม ${senderProviderLabel} แล้ว · ส่งจากบัญชีนี้โดยตรง · PO กด Reply กลับหาคุณได้` : `ต้องเชื่อม ${senderProviderLabel} และอนุญาตส่งเมลก่อนใช้งานครั้งแรก`}</small></label><label className="text-field"><span>ผู้รับ *</span><input type="email" value={poEmail} onChange={(event) => setPoEmail(event.target.value)} placeholder="po@company.com" /></label><div className="approval-wide-field">{mailConnection && <button type="button" className="secondary-button" onClick={connectMail} disabled={sendingApproval || !senderProvider || !mailConnection.configured}>{mailConnection.connected ? `เชื่อมสิทธิ์ ${senderProviderLabel} ใหม่` : `เชื่อม ${senderProviderLabel} เพื่อส่งอีเมล`}</button>}{(mailNotice || mailConnection?.error) && <p role="status">{mailConnection?.error || mailNotice}</p>}</div><label className="text-field approval-wide-field"><span>CC</span><input type="text" value={ccEmail} onChange={(event) => setCcEmail(event.target.value)} placeholder="qa-lead@company.com, manager@company.com (ไม่เกิน 10 คน)" /></label><label className="text-field approval-wide-field"><span>หัวข้ออีเมล</span><input value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} maxLength={300} /></label><label className="text-field approval-note"><span>เนื้อหาอีเมล (แก้ไขได้)</span><textarea rows={9} value={emailBody} onChange={(event) => setEmailBody(event.target.value)} maxLength={50000} /></label></div>}
    {approval && <div className={`approval-status-card ${approval.status}`}><div><strong>{approvalLabel}</strong><span>{approval.recipientEmail} · {mailDeliveryLabel(approval.emailId, approval.emailSentAt)}</span>{approval.emailError && <p role="status">{approval.emailError}</p>}</div>{approval.reviewerName && <span>โดย {approval.reviewerName}</span>}{approval.reviewerComment && <p>{approval.reviewerComment}</p>}</div>}
    <div className="approval-footer"><div>{project.googleSheetUrl ? <a href={project.googleSheetUrl} target="_blank" rel="noreferrer"><FileSpreadsheet size={16} />เปิด Google Sheets</a> : canSubmit ? <button type="button" className="text-button" onClick={onConnectSheet}>เชื่อม Google Sheet ก่อนส่ง</button> : <span>ยังไม่ได้เชื่อม Google Sheet</span>}<small>{canSubmit ? (!evidenceReady ? "นำเข้าหลักฐานให้ครบเพื่อเปิดการส่งให้ PO" : testingFinished ? "อีเมลจะมีลิงก์ให้ PO เปิดรีวิวและกด Approved" : "กดส่งได้ แต่ระบบจะแจ้งเตือนให้ยืนยันก่อน") : "คุณมีสิทธิ์ดูสถานะ Approval เท่านั้น"}</small></div>{canSubmit && <button type="button" className="primary-button" onClick={openApprovalEmail} disabled={loading || sendingApproval || preparingEvidence || !evidenceReady || !project.googleSheetUrl || !mailConnection || mailConnection.configured === false}>{sendingApproval ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}{approvalMatchesRecipient ? "ส่งอัปเดตให้ PO" : "ส่งอีเมลขอ Approve"}</button>}</div>
  </section>
  {canSubmit && showUntestedConfirmation && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowUntestedConfirmation(false)}><section className="approval-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="approval-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
    <button type="button" className="icon-button close-button" onClick={() => setShowUntestedConfirmation(false)} aria-label="ปิด"><X size={19} /></button>
    <div className="approval-confirm-icon"><CircleAlert size={28} /></div>
    <h2 id="approval-confirm-title">ยังมี Test Case ที่ยังไม่ได้ทดสอบ</h2>
    <p>{cases.length ? `พบ Test Case ที่ยังดำเนินการไม่เสร็จ ${untested} รายการ` : "Project นี้ยังไม่มี Test Case"}</p>
    {cases.length > 0 && <div className="approval-pending-summary"><div><span>Not Start</span><strong>{counts["Not Start"]}</strong></div><div><span>Inprogress</span><strong>{counts["In Progress"]}</strong></div></div>}
    <div className="approval-confirm-note"><CircleAlert size={17} /><span>อีเมลจะระบุจำนวน Test Case ที่ยังไม่ได้ทดสอบให้ PO เห็นด้วย</span></div>
    <div className="dialog-actions"><button type="button" className="secondary-button" onClick={() => setShowUntestedConfirmation(false)}>ยกเลิก</button><button type="button" className="primary-button" disabled={sendingApproval} onClick={() => void launchApprovalEmail()}>{sendingApproval ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}ยืนยันส่งอีเมล</button></div>
  </section></div>}
  </>;
}

function PlusIcon() {
  return <span className="plus-icon" aria-hidden>+</span>;
}

function SheetContentShimmer({ text = true, images = true }: { text?: boolean; images?: boolean }) {
  return <div className="sheet-content-shimmer" role="status" aria-label="กำลังโหลดข้อมูลจาก Google Sheets">
    {images && <div className="sheet-image-shimmer" aria-hidden><span /><span /><span /></div>}
    {text && <div className="sheet-text-shimmer" aria-hidden><span /><span /><span /><span /></div>}
  </div>;
}

function CaseDrawerSkeleton() {
  return <div className="drawer-backdrop case-route-backdrop" role="status" aria-label="กำลังโหลดรายละเอียด Test Case"><aside className="case-drawer case-route-editor skeleton-case-drawer">
    <header className="drawer-header"><div className="skeleton-heading"><span /><span /></div><i className="skeleton-button" /></header>
    <div className="drawer-body">
      <div className="case-context skeleton-context"><span /><span /><span /></div>
      {["scenario", "condition", "steps", "expected"].map((section, index) => <section className={`readonly-block skeleton-readonly ${section === "expected" ? "expected" : ""}`} key={section}><i /><div>{Array.from({ length: index > 1 ? 4 : 2 }, (_, line) => <span key={line} />)}</div></section>)}
      <div className="form-section-title"><span className="skeleton-inline" /></div>
      <div className="skeleton-form-grid"><span /><span /><span /><span /></div>
      <div className="result-preview-list skeleton-result"><header><span /><span /></header><div className="sheet-text-shimmer"><span /><span /><span /></div><div className="sheet-image-shimmer"><span /><span /><span /></div></div>
    </div>
  </aside></div>;
}

function ResultSheetViewer({ source, sheet, imagesOnly = false, displayedEvidence = [], contentOverride, showImages = true }: { showImages?: boolean; source: WorkbookSource; sheet: WorkbookSheet; imagesOnly?: boolean; displayedEvidence?: TestEvidence[]; contentOverride?: WorkbookSheetContent | null }) {
  const result = useMemo<{ content: WorkbookSheetContent | null; error: string }>(() => {
    try {
      return { content: contentOverride ?? readWorkbookSheet(source, sheet), error: "" };
    } catch (reason) {
      return { content: null, error: reason instanceof Error ? reason.message : "อ่านข้อมูลใน sheet ไม่สำเร็จ" };
    }
  }, [sheet, source, contentOverride]);
  const imageUrls = useMemo(() => (result.content?.images ?? []).filter(item => !isImportedEvidenceDisplayed(sheet.name, item.row, item.column, displayedEvidence)).map((item) => ({
    name: item.name,
    url: URL.createObjectURL(new Blob([new Uint8Array(item.bytes)], { type: item.mimeType })),
  })), [result.content, sheet.name, displayedEvidence]);
  const pendingRevoke = useRef<{ images: typeof imageUrls; timer: number } | null>(null);
  useEffect(() => {
    const pending = pendingRevoke.current;
    if (pending) {
      window.clearTimeout(pending.timer);
      if (pending.images !== imageUrls) pending.images.forEach((item) => URL.revokeObjectURL(item.url));
      pendingRevoke.current = null;
    }
    return () => {
      const timer = window.setTimeout(() => {
        imageUrls.forEach((item) => URL.revokeObjectURL(item.url));
        if (pendingRevoke.current?.timer === timer) pendingRevoke.current = null;
      }, 0);
      pendingRevoke.current = { images: imageUrls, timer };
    };
  }, [imageUrls]);
  const content = result.content;
  if (result.error) return <p className="form-error"><CircleAlert size={16} />{result.error}</p>;
  if (!content) return null;
  if (imagesOnly && !imageUrls.length) return null;
  return <div className="sheet-viewer">
    {showImages && <ImageViewerGallery className="evidence-gallery" images={imageUrls.map((item, index) => ({ id: `${item.name}-${index}`, name: `หลักฐานจาก ${sheet.name} รูปที่ ${index + 1}`, url: item.url }))} />}
    {!imagesOnly && content.cells.length > 0 && <details><summary>ข้อมูลใน sheet ({content.cells.length}{content.truncatedCellCount ? "+" : ""} cells)</summary><div className="sheet-cell-list">{content.cells.map((cell) => <div key={cell.ref}><strong>{cell.ref}</strong><pre>{cell.value}</pre></div>)}</div></details>}
  </div>;
}

function CaseDrawer({ value, projectId, source, associatedSheets, caseDisplayNames = {}, currentUserName, readOnly = false, pageMode = false, loadingSheetDetails = false, focusedSheetName = "", onClose, onSave, onSaveResult, onEnsureWorkbook }: { value: TestCase; projectId: string; source: WorkbookSource | null; associatedSheets?: WorkbookSheet[]; caseDisplayNames?: Record<string,string>; currentUserName: string; readOnly?: boolean; pageMode?: boolean; loadingSheetDetails?: boolean; focusedSheetName?: string; onClose: () => void; onSave: (value: TestCase) => Promise<void>; onSaveResult: (value: TestCase) => Promise<TestCase>; onEnsureWorkbook: () => Promise<WorkbookSource> }) {
  const [draft, setDraft] = useState<TestCase>(() => {
    if (readOnly) return { ...value };
    let remembered: { platform?: string; environment?: string; device?: string; appVersion?: string; executedBy?: string; testData?: string } = {};
    try { remembered = JSON.parse(window.localStorage.getItem(`qa-test-defaults:${projectId}`) ?? "{}"); } catch { /* ใช้ค่าเดิมเมื่อ localStorage ไม่พร้อม */ }
    const hasSavedExecution = Boolean(value.persistedLocally || value.results?.length || value.defects?.length);
    const projectDefault = (savedValue: string, rememberedValue?: string) => hasSavedExecution
      ? savedValue || rememberedValue || ""
      : rememberedValue || savedValue || "";
    return {
      ...value,
      platform: projectDefault(value.platform, remembered.platform),
      environment: projectDefault(value.environment, remembered.environment),
      device: projectDefault(value.device, remembered.device),
      appVersion: projectDefault(value.appVersion, remembered.appVersion),
      executedBy: projectDefault(value.executedBy, remembered.executedBy) || currentUserName,
      testData: projectDefault(value.testData, remembered.testData),
    };
  });
  const [lastIncomingCase, setLastIncomingCase] = useState(value);
  if (value !== lastIncomingCase) {
    setLastIncomingCase(value);
    setDraft(current => refreshCaseDraft(current, lastIncomingCase, value));
  }
  const [actualResult, setActualResult] = useState("");
  const [resultStepId, setResultStepId] = useState("");
  const [resultStatus, setResultStatus] = useState<TestStatus>("Not Start");
  const [apiResponse, setApiResponse] = useState("");
  const [log, setLog] = useState("");
  const [resultCustomFields, setResultCustomFields] = useState<TestCaseResultField[]>(() => (value.resultFieldDefinitions ?? []).map((field) => ({ ...field, value: "" })));
  const [defectTitle, setDefectTitle] = useState("");
  const [defectResult, setDefectResult] = useState("");
  const [defectStatus, setDefectStatus] = useState("Open");
  const [jiraUrl, setJiraUrl] = useState("");
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [editingDefectId, setEditingDefectId] = useState<string | null>(null);
  const [showResultEntry, setShowResultEntry] = useState(false);
  const [showDefectEntry, setShowDefectEntry] = useState(false);
  const [editingCaseDetails, setEditingCaseDetails] = useState(false);
  const [savingResult, setSavingResult] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [draggingEvidence, setDraggingEvidence] = useState(false);
  const [error, setError] = useState("");
  const [viewingSheet, setViewingSheet] = useState<WorkbookSheet | null>(null);
  const [loadingWorkbook, setLoadingWorkbook] = useState(false);
  const evidenceInput = useRef<HTMLInputElement>(null);
  const [compressVideo, setCompressVideo] = useState(false);
  const [uploadStage, setUploadStage] = useState("");
  const resultSheets = focusedSheetName
    ? source?.sheets.filter((sheet) => sheet.name === focusedSheetName) ?? []
    : associatedSheets ?? source?.sheets.filter((sheet) => sheet.name.trim().toUpperCase() === value.id.trim().toUpperCase() || testCaseIdsFromSheet(sheet).some((id) => testCaseIdentity(id) === testCaseIdentity(value.id))) ?? [];
  const remainingResultSheets = unrepresentedResultSheets(resultSheets, draft.results ?? []);
  const evidenceCount = remainingResultSheets.reduce((total, sheet) => total + sheet.imageCount, 0);
  const focusedResultCaptured = !!focusedSheetName && !remainingResultSheets.some(sheet => sheet.name === focusedSheetName);
  const sharedSheets = resultSheets.filter(sheet => sheet.testCaseIds.length > 1);
  const displayedResultEvidence = useMemo(() => (draft.results ?? []).flatMap(result => result.evidence), [draft.results]);
  const focusedEvidence = useMemo(() => {
    if (focusedResultCaptured) return { sheet: undefined, content: null, remaining: 0 };
    const sheet = source?.sheets.find(sheet => sheet.name === focusedSheetName);
    if (!source?.bufferLoaded || !sheet) return { sheet, content: null, remaining: sheet?.imageCount ?? 0 };
    try {
      const content = readWorkbookSheet(source, sheet);
      return { sheet, content, remaining: content.images.filter(image => !isImportedEvidenceDisplayed(sheet.name, image.row, image.column, displayedResultEvidence)).length };
    } catch { return { sheet, content: null, remaining: 0 }; }
  }, [source, focusedSheetName, displayedResultEvidence, focusedResultCaptured]);
  const additionalCustomFields = [...new Map(
    (draft.customFields ?? [])
      .filter((field) => field.column >= 0 && !isResultRecordField(field.label) && !(field.source === "detail" && isSheetPayloadLabel(field.label)))
      .map((field) => [field.key, field]),
  ).values()];
  const update = (field: keyof TestCase, next: string) => setDraft((current) => ({ ...current, [field]: next }));
  const updateCustomField = (key: string, value: string) => setDraft((current) => {
    const target = current.customFields?.find((field) => field.key === key);
    if (!target) return current;

    return {
      ...current,
      customFields: (current.customFields ?? []).map((field) =>
        field.key === key
          ? { ...field, value }
          : field,
      ),
    };
  });
  const rememberDefaults = (testCase: TestCase) => window.localStorage.setItem(`qa-test-defaults:${projectId}`, JSON.stringify({ platform: testCase.platform, environment: testCase.environment, device: testCase.device, appVersion: testCase.appVersion, executedBy: testCase.executedBy, testData: testCase.testData }));
  function resetResultForm() {
    setResultStepId("");
    setResultStatus("Not Start");
    setActualResult("");
    setApiResponse("");
    setLog("");
    setResultCustomFields((draft.resultFieldDefinitions ?? []).map((field) => ({ ...field, value: "" })));
    setDefectTitle("");
    setDefectResult("");
    setDefectStatus("Open");
    setJiraUrl("");
    setEditingResultId(null);
    setShowResultEntry(false);
    setEditingDefectId(null);
    setShowDefectEntry(false);
    setDraft((current) => ({ ...current, evidence: [] }));
  }
  async function saveResult() {
    if (draft.stepDefinitions?.length && !resultStepId && !editingResultId) {
      setError("กรุณาเลือก Step ที่เป็นเจ้าของ Result");
      return;
    }
    if (!actualResult.trim() && !apiResponse.trim() && !log.trim() && !draft.evidence.length && !resultCustomFields.some((field) => field.value.trim())) {
      setError("กรุณาใส่ผลทดสอบ รูป API response หรือ log อย่างน้อยหนึ่งรายการ");
      return;
    }
    const createdAt = new Date().toISOString();
    const result: TestResult = {
      id: crypto.randomUUID(),
      editedLocally: true,
      stepId: resultStepId || undefined,
      testerName: draft.executedBy.trim() || currentUserName.trim(),
      source: 'web',
      sourceSheetName: focusedSheetName || undefined,
      status: draft.stepDefinitions?.length ? resultStatus : draft.status,
      actualResult: actualResult.trim(),
      apiResponse: apiResponse.trim(),
      log: log.trim(),
      evidence: draft.evidence,
      customFields: resultCustomFields,
      createdAt,
    };
    const next = withPassedTimestamp({
      ...draft,
      ...(draft.stepDefinitions?.length ? (() => {
        const stepDefinitions = draft.stepDefinitions.map(step => step.id === resultStepId ? { ...step, status: resultStatus, rawStatus: resultStatus, executedBy: draft.executedBy || currentUserName, executedDate: createdAt.slice(0, 10), device: draft.device, environment: draft.environment, appVersion: draft.appVersion } : step);
        return { stepDefinitions, status: aggregateStepStatus(stepDefinitions) };
      })() : {}),
      executedBy: draft.executedBy.trim() || currentUserName.trim(),
      remark: actualResult.trim() || draft.remark,
      evidence: [],
      results: editingResultId
        ? (draft.results ?? []).map((item) => testResultIdentity(item) === editingResultId ? { ...item, ...result, id: item.id, sourceSheetName: item.sourceSheetName, source:item.source ?? (item.sourceSheetName ? 'sheets' : 'web'), createdAt: item.createdAt,origin:item.origin, testerName:item.testerName ?? item.origin?.authorName ?? result.testerName } : item)
        : [result, ...(draft.results ?? [])],
    });
    setSavingResult(true);
    setError("");
    try {
      rememberDefaults(next);
      const saved = await onSaveResult(next);
      setDraft(saved);
      resetResultForm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึก Result ไม่สำเร็จ");
    } finally {
      setSavingResult(false);
    }
  }
  function editResult(result: TestResult) {
    resetResultForm();
    setResultStepId(result.stepId ?? "");
    setResultStatus(result.status);
    setShowResultEntry(false);
    setEditingResultId(testResultIdentity(result));
    setActualResult(result.actualResult);
    setApiResponse(result.apiResponse);
    setLog(result.log);
    setResultCustomFields((draft.resultFieldDefinitions ?? result.customFields ?? []).map((definition) => ({
      ...definition,
      value: result.customFields?.find((field) => field.key === definition.key || field.label.trim().toLowerCase() === definition.label.trim().toLowerCase())?.value ?? definition.value ?? "",
    })));
    setDraft((current) => ({ ...current, evidence: result.evidence }));
  }
  async function saveDefect() {
    if (!defectTitle.trim()) return setError("กรุณาใส่ชื่อ Defect");
    if (!defectResult.trim() && !apiResponse.trim() && !log.trim() && !draft.evidence.length) return setError("กรุณาใส่ Result รูป API response หรือ log ของ Defect อย่างน้อยหนึ่งรายการ");
    const defect: TestDefect = {
      id: crypto.randomUUID(), title: defectTitle.trim(), description: defectResult.trim(), status: defectStatus,
      jiraUrl: jiraUrl.trim(), apiResponse: apiResponse.trim(), log: log.trim(), evidence: draft.evidence, createdAt: new Date().toISOString(),
    };
    const next = withPassedTimestamp({
      ...draft, executedBy: draft.executedBy.trim() || currentUserName.trim(), evidence: [],
      defects: editingDefectId
        ? (draft.defects ?? []).map((item) => item.id === editingDefectId ? { ...defect, id: item.id, createdAt: item.createdAt } : item)
        : [...(draft.defects ?? []), defect],
    });
    setSavingResult(true); setError("");
    try { rememberDefaults(next); const saved = await onSaveResult(next); setDraft(saved); resetResultForm(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "บันทึก Defect ไม่สำเร็จ"); }
    finally { setSavingResult(false); }
  }
  function editDefect(defect: TestDefect) {
    resetResultForm(); setEditingDefectId(defect.id); setDefectTitle(defect.title); setDefectResult(defect.description);
    setDefectStatus(defect.status); setJiraUrl(defect.jiraUrl); setApiResponse(defect.apiResponse); setLog(defect.log);
    setDraft((current) => ({ ...current, evidence: defect.evidence }));
  }
  async function deleteDefect(defect: TestDefect) {
    if (!window.confirm("ลบ Defect รายการนี้หรือไม่?")) return;
    setSavingResult(true); setError("");
    try {
      const saved = await onSaveResult({ ...draft, evidence: [], defects: (draft.defects ?? []).filter((item) => item.id !== defect.id) });
      setDraft(saved); if (editingDefectId === defect.id) resetResultForm();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "ลบ Defect ไม่สำเร็จ"); }
    finally { setSavingResult(false); }
  }
  async function deleteResult(result: TestResult) {
    if (!window.confirm("ลบ Result รายการนี้หรือไม่?")) return;
    setSavingResult(true);
    setError("");
    try {
      const resultKey = testResultIdentity(result);
      const saved = await onSaveResult({ ...draft, evidence: [], results: (draft.results ?? []).filter((item) => testResultIdentity(item) !== resultKey) });
      setDraft(saved);
      if (editingResultId === resultKey) resetResultForm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ลบ Result ไม่สำเร็จ");
    } finally {
      setSavingResult(false);
    }
  }
  async function save() {
    setSaving(true);
    setError("");
    try {
      const next = withPassedTimestamp({ ...draft, executedBy: draft.executedBy.trim() || currentUserName.trim() });
      rememberDefaults(next);
      await onSave(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึกผลไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }
  async function saveCaseDetails() {
    if (!draft.id.trim() || !draft.name.trim() || !draft.steps.trim() || !draft.expected.trim()) {
      setError("กรุณากรอก Test Case ID, ชื่อ Test Case, ขั้นตอนทดสอบ และ Expected Result");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const next = { ...draft, id: draft.id.trim(), name: draft.name.trim(), scenario: draft.scenario.trim(), condition: draft.condition.trim(), steps: draft.steps.trim(), expected: draft.expected.trim() };
      await onSave(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึก Test Case ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }
  function cancelCaseDetailsEdit() {
    setDraft((current) => ({ ...current, id: value.id, name: value.name, scenario: value.scenario, condition: value.condition, steps: value.steps, expected: value.expected }));
    setEditingCaseDetails(false);
    setError("");
  }
  async function uploadEvidence(files?: ArrayLike<File>) {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;
    const invalidFile = selectedFiles.find((file) => validateEvidenceFile(file));
    if (invalidFile) {
      setError(`${invalidFile.name}: ${validateEvidenceFile(invalidFile)}`);
      return;
    }
    setUploadingEvidence(true);
    setError("");
    try {
      for (const file of selectedFiles) {
        setUploadStage(`${file.type === "image/gif" ? "บีบอัด GIF" : "เตรียม"} ${file.name}`);
        const prepared = file.type.startsWith("video/") && compressVideo
          ? await compressEvidenceVideo(file, (percent) => setUploadStage(`บีบอัด ${file.name} · ${percent}%`))
          : await compressEvidenceImage(file);
        if (file.type.startsWith("video/")) {
          setUploadStage(`อัปโหลด ${file.name}${prepared.compressed ? ` · ลดเหลือ ${(prepared.file.size / 1024 / 1024).toFixed(1)} MB` : compressVideo ? " · ใช้ไฟล์ต้นฉบับ" : ""}`);
          const api = `/api/projects/${projectId}/evidence/upload`;
          const signed = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: prepared.file.name, type: prepared.file.type, size: prepared.file.size, testCaseId: draft.id }) });
          const upload = await signed.json();
          if (!signed.ok) throw new Error(upload.error ?? "เตรียม Upload ไม่สำเร็จ");
          let sent: Response;
          try { sent = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": prepared.file.type }, body: prepared.file }); }
          catch { throw new Error("อัปโหลดวิดีโอไม่สำเร็จ กรุณาตรวจ CORS ของ R2 ให้รองรับเว็บนี้และ PUT"); }
          if (!sent.ok) throw new Error("อัปโหลดวิดีโอไม่สำเร็จ");
          const complete = await fetch(api, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket: upload.ticket }) });
          const data = await complete.json();
          if (!complete.ok) throw new Error(data.error ?? "ตรวจสอบ Upload ไม่สำเร็จ");
          setDraft((current) => ({ ...current, evidence: [...current.evidence, data.evidence] }));
          continue;
        }
        const imageSize = prepared.file.size >= 1024 * 1024 ? `${(prepared.file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(prepared.file.size / 1024)} KB`;
        setUploadStage(`อัปโหลด ${file.name}${prepared.compressed ? ` · ลดเหลือ ${imageSize}` : ""}`);
        const form = new FormData();
        form.set("file", prepared.file);
        form.set("testCaseId", draft.id);
        form.set("sourceRow", String(draft.sourceRow));
        const response = await fetch(`/api/projects/${projectId}/evidence`, { method: "POST", body: form });
        const data = await response.json();
        if (response.status === 401 && data.authUrl) {
          continueGoogleAuthorization(data.authUrl);
          return;
        }
        if (!response.ok) throw new Error(data.error ?? `อัปโหลด ${file.name} ไม่สำเร็จ`);
        setDraft((current) => ({ ...current, evidence: [...current.evidence, data.evidence] }));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "อัปโหลดหลักฐานไม่สำเร็จ");
    } finally {
      setUploadingEvidence(false);
      if (evidenceInput.current) evidenceInput.current.value = "";
    }
  }
  function renderEvidencePicker(label: string) {
    return <div
      className={`evidence-dropzone ${draggingEvidence ? "dragging" : ""} ${uploadingEvidence ? "uploading" : ""}`}
      role="button"
      tabIndex={uploadingEvidence ? -1 : 0}
      aria-disabled={uploadingEvidence}
      onClick={() => !uploadingEvidence && evidenceInput.current?.click()}
      onKeyDown={(event) => {
        if (!uploadingEvidence && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          evidenceInput.current?.click();
        }
      }}
      onDragEnter={(event) => { event.preventDefault(); if (!uploadingEvidence) setDraggingEvidence(true); }}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = uploadingEvidence ? "none" : "copy"; }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingEvidence(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDraggingEvidence(false);
        if (!uploadingEvidence) void uploadEvidence(event.dataTransfer.files);
      }}
    >
      <input ref={evidenceInput} type="file" accept={EVIDENCE_ACCEPT} multiple hidden onChange={(event) => void uploadEvidence(event.target.files ?? undefined)} />
      {uploadingEvidence ? <LoaderCircle className="spin" size={24} /> : <Upload size={24} />}
      <div><strong>{uploadingEvidence ? uploadStage : "ลากรูปหรือวิดีโอมาวางที่นี่"}</strong><small>{uploadingEvidence ? "กรุณารอสักครู่" : `หรือคลิกเลือกหลักฐานสำหรับ${label} · รูปไม่เกิน 10 MB · GIF และวิดีโอ MP4, WebM, MOV ไม่เกิน 25 MB`}</small></div>
      <span>{draft.evidence.length} ไฟล์</span>
    </div>;
  }
  function renderResultFields(submitLabel: string, onCancel?: () => void) {
    return <>
      {!!draft.stepDefinitions?.length && <div className="two-column-fields"><label><span>Step ของ Result</span><select value={resultStepId} onChange={event => setResultStepId(event.target.value)}><option value="">{editingResultId ? "ผลที่ยังไม่ผูก Step" : "เลือก Step"}</option>{draft.stepDefinitions.map(step => <option key={step.id} value={step.id}>{step.name} · {step.description}</option>)}</select></label><label><span>สถานะ Result</span><select value={resultStatus} onChange={event => setResultStatus(event.target.value as TestStatus)}>{TEST_STATUSES.map(status => <option key={status}>{status}</option>)}</select></label></div>}
      <label className="text-field"><span>ผลที่พบ / Actual result</span><textarea rows={3} value={actualResult} onChange={(event) => setActualResult(event.target.value)} placeholder="รายละเอียดผลทดสอบรอบนี้" /></label>
      <div className="result-input-grid"><label className="text-field"><span>API response</span><textarea className="code-input" rows={7} value={apiResponse} onChange={(event) => setApiResponse(event.target.value)} placeholder="วาง response JSON หรือข้อความ" /></label>
      <label className="text-field"><span>Log</span><textarea className="code-input" rows={7} value={log} onChange={(event) => setLog(event.target.value)} placeholder="วาง application log" /></label></div>
      {resultCustomFields.length > 0 && <div className="result-custom-fields"><div className="result-form-heading"><div><span>ฟิลด์ Result จาก tab {displayTestCaseId(draft)}</span><small>ดึงจากหัวตาราง Result ของชีตนี้</small></div><strong>{resultCustomFields.length} fields</strong></div><div className="dynamic-field-grid">{resultCustomFields.map((field) => <label className="text-field" key={field.key}><span>{field.label}</span>{field.value.includes("\n") || field.value.length > 100 ? <textarea rows={3} value={field.value} onChange={(event) => setResultCustomFields((current) => current.map((item) => item.key === field.key ? { ...item, value: event.target.value } : item))} /> : <input value={field.value} onChange={(event) => setResultCustomFields((current) => current.map((item) => item.key === field.key ? { ...item, value: event.target.value } : item))} />}</label>)}</div></div>}
      <div className="result-evidence-entry">
        <span className="field-label">หลักฐานของ Result นี้</span>
        <label className="video-compression-option"><input type="checkbox" checked={compressVideo} onChange={(event) => setCompressVideo(event.target.checked)} disabled={uploadingEvidence} />บีบอัดวิดีโอก่อนอัปโหลด (คลิปไม่เกิน 2 นาที · ใช้เวลาใกล้เคียงความยาวคลิป)</label>
        <ImageViewerGallery images={evidenceViewerImages(draft.evidence)} />
        {renderEvidencePicker(" Result นี้")}
      </div>
      <div className="result-editor-actions">
        {onCancel && <button className="secondary-button" type="button" onClick={onCancel} disabled={savingResult}>ยกเลิกการแก้ไข</button>}
        <button className="primary-button add-result-button" type="button" onClick={() => void saveResult()} disabled={savingResult}>{savingResult ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{submitLabel}</button>
      </div>
    </>;
  }
  function renderDefectFields(submitLabel: string, onCancel?: () => void) {
    return <>
      <label className="text-field"><span>ชื่อ Defect</span><input value={defectTitle} onChange={(event) => setDefectTitle(event.target.value)} placeholder="ชื่อหรือรายละเอียดย่อ" /></label>
      <label className="text-field"><span>ผลที่พบ / Actual result</span><textarea rows={3} value={defectResult} onChange={(event) => setDefectResult(event.target.value)} placeholder="รายละเอียดบั๊กที่พบใน Test case นี้" /></label>
      <div className="result-input-grid"><label className="text-field"><span>API response</span><textarea className="code-input" rows={7} value={apiResponse} onChange={(event) => setApiResponse(event.target.value)} placeholder="วาง response JSON หรือข้อความ" /></label><label className="text-field"><span>Log</span><textarea className="code-input" rows={7} value={log} onChange={(event) => setLog(event.target.value)} placeholder="วาง application log" /></label></div>
      <div className="result-evidence-entry"><span className="field-label">หลักฐานของ Defect นี้</span><label className="video-compression-option"><input type="checkbox" checked={compressVideo} onChange={(event) => setCompressVideo(event.target.checked)} disabled={uploadingEvidence} />บีบอัดวิดีโอก่อนอัปโหลด (คลิปไม่เกิน 2 นาที)</label><ImageViewerGallery images={evidenceViewerImages(draft.evidence)} />{renderEvidencePicker(" Defect นี้")}</div>
      <div className="two-column-fields"><label><span>สถานะ Defect</span><select value={defectStatus} onChange={(event) => setDefectStatus(event.target.value)}><option>Open</option><option>In Progress</option><option>Resolved</option><option>Closed</option></select></label><label><span>Jira card URL</span><input type="url" value={jiraUrl} onChange={(event) => setJiraUrl(event.target.value)} placeholder="https://...atlassian.net/browse/..." /></label></div>
      <div className="result-editor-actions">{onCancel && <button className="secondary-button" type="button" onClick={onCancel} disabled={savingResult}>ยกเลิกการแก้ไข</button>}<button className="primary-button add-result-button" type="button" onClick={() => void saveDefect()} disabled={savingResult}>{savingResult ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{submitLabel}</button></div>
    </>;
  }
  const renderResults = (results: TestResult[], title = "Result Testing") => (
          results.length > 0 && <div className="result-preview-list">
            <div className="result-sheet-heading"><h3 className="result-testing-heading">{title}</h3><strong>{results.length} รายการ</strong></div>
            {results.map((result, index) => { const resultKey = testResultIdentity(result); return <article key={resultKey} className={editingResultId === resultKey ? "editing" : ""}><header><strong>{draft.stepDefinitions?.length || result.sharedSheetMappingVersion ? stepResultTitle(draft, result) : `ผลที่ ${index + 1}`}</strong><StatusBadge status={result.status} /><time>{formatFlexibleDate(result.createdAt)}</time>{!readOnly && editingResultId !== resultKey && <><button type="button" className="secondary-button result-edit-button" onClick={() => editResult(result)}>แก้ไข</button><button type="button" className="danger-button result-delete-button" disabled={savingResult} onClick={() => void deleteResult(result)}><Trash2 size={13} />ลบ</button></>}</header>{draft.stepDefinitions?.length && !result.sharedSheetMappingVersion && !readOnly && <ResultStepMapping result={result} steps={draft.stepDefinitions} saving={savingResult} onSave={async (stepId) => { setSavingResult(true); setError(""); try { const next = { ...draft, results: (draft.results ?? []).map(item => testResultIdentity(item) === resultKey ? { ...item, stepId: stepId || undefined, stepMappingHistory: [...(item.stepMappingHistory ?? []), { fromStepId: item.stepId ?? null, toStepId: stepId || null, by: currentUserName, at: new Date().toISOString() }] } : item) }; setDraft(await onSaveResult(next)); } catch (reason) { setError(reason instanceof Error ? reason.message : "บันทึกการจับคู่ไม่สำเร็จ"); throw reason; } finally { setSavingResult(false); } }} />}{result.origin && <small className="result-origin-label">{result.origin.inferred ? 'Sprint ที่อนุมานจากข้อมูลเดิม/นำเข้า' : 'Sprint ต้นกำเนิด'}: {result.origin.sprintName} · {result.origin.year}{!result.origin.inferred && result.origin.authorName ? ` · ผู้บันทึก: ${result.origin.authorName}` : ' · ไม่ระบุผู้บันทึกต้นกำเนิด'}</small>}{editingResultId === resultKey ? <div className="result-entry-block inline-result-editor"><div className="result-form-heading"><div><span>{`แก้ไขผลที่ ${index + 1} ของ ${displayTestCaseId(draft)}`}</span><small>บันทึกแล้วจะแทนที่ Result รายการนี้</small></div></div>{renderResultFields("บันทึกการแก้ไข Result", resetResultForm)}</div> : <>{(result.sheetSections?.length ?? 0) > 0 && <SheetResultSections sections={result.sheetSections!} images={evidenceViewerImages(result.evidence)} sheetName={result.sourceSheetName ?? ""} />}{!result.sheetSections?.length && result.actualResult && <ResultActualText text={result.actualResult} highlights={result.textHighlights?.actualResult} />}{(result.customFields?.length ?? 0) > 0 && <dl className="result-custom-preview">{result.customFields?.map((field) => <div key={field.key}><dt>{field.label}</dt><dd><ResultTextViewer title={field.label} text={field.value || "—"} /></dd></div>)}</dl>}{!result.sheetSections?.length && result.apiResponse && <ResultTextViewer title="API response" text={result.apiResponse} highlights={result.textHighlights?.apiResponse} onSave={readOnly ? undefined : async (text, highlights) => { const next = { ...draft, results: (draft.results ?? []).map(item => testResultIdentity(item) === resultKey ? { ...item, apiResponse: text, textHighlights: { ...item.textHighlights, apiResponse: highlights } } : item) }; const saved = await onSaveResult(next); setDraft(saved); }} />}{!result.sheetSections?.length && result.log && <ResultTextViewer title="Log" text={result.log} highlights={result.textHighlights?.log} onSave={readOnly ? undefined : async (text, highlights) => { const next = { ...draft, results: (draft.results ?? []).map(item => testResultIdentity(item) === resultKey ? { ...item, log: text, textHighlights: { ...item.textHighlights, log: highlights } } : item) }; const saved = await onSaveResult(next); setDraft(saved); }} />}{!result.sheetSections?.length && <ImageViewerGallery className="drive-evidence-gallery result-evidence-gallery" images={evidenceViewerImages(result.evidence)} />}</>}</article>; })}
          </div>
  );
  return (
    <div className={`drawer-backdrop ${pageMode ? "case-route-backdrop" : ""}`} role="presentation" onMouseDown={pageMode ? undefined : onClose}>
      <aside className={`case-drawer ${pageMode ? "case-route-editor" : ""} ${readOnly ? "read-only-case" : ""}`} role="dialog" aria-modal="true" aria-labelledby="case-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="drawer-header">
          <div><span className="case-id">{displayTestCaseId(draft)}</span><h2 id="case-title">{draft.name}</h2></div>
          <div className="case-header-actions">{readOnly && <span className="read-only-badge">ดูอย่างเดียว</span>}{!readOnly && !editingCaseDetails && !draft.stepDefinitions?.length && <button type="button" className="secondary-button" onClick={() => setEditingCaseDetails(true)}>แก้ไข Test Case</button>}<button className="icon-button" onClick={onClose} aria-label="ปิด"><X size={20} /></button></div>
        </header>
        <div className="drawer-body">
          <div className="case-context"><span>{draft.platform || "ไม่ระบุ Platform"}</span><span>{draft.environment || "ไม่ระบุ Env"}</span><span>{draft.appVersion || "ไม่ระบุ Build"}</span></div>
          {sharedSheets.map(sheet => <SharedSheetDefinition key={sheet.path} caseId={displayTestCaseId(draft)} sheetName={sheet.name} caseIds={sheet.testCaseIds.map(id=>caseDisplayNames[id] ?? id)} table={draft.results?.find(result => result.sourceSheetName === sheet.name && result.sheetDefinitionTable)?.sheetDefinitionTable} />)}
          {!editingCaseDetails && !sharedSheets.length && <TestCaseSourceDetails testCase={draft} />}
          {!sharedSheets.length && <TestCaseSteps testCase={draft} readOnly={readOnly} onChange={setDraft} renderResults={renderResults} onAddResult={stepId => { resetResultForm(); setResultStepId(stepId); setShowResultEntry(true); }} />}
          {editingCaseDetails ? <section className="testcase-details-editor">
            <div className="result-form-heading"><div><span>แก้ไข Test Case</span><small>การแก้ไขจะถูกบันทึกในระบบ และรอซิงค์กลับ Google Sheets</small></div></div>
            <div className="two-column-fields"><label><span>Test Case ID *</span><input value={displayTestCaseId(draft)} readOnly={Boolean(draft.registerIdentity)} onChange={(event) => update("id", event.target.value)} /></label><label><span>Platform</span><input value={draft.platform} onChange={(event) => update("platform", event.target.value)} /></label></div>
            <label className="text-field"><span>Test Case Name *</span><input value={draft.name} onChange={(event) => update("name", event.target.value)} /></label>
            <label className="text-field"><span>Test Scenario</span><textarea rows={3} value={draft.scenario} onChange={(event) => update("scenario", event.target.value)} /></label>
            <label className="text-field"><span>Condition</span><textarea rows={2} value={draft.condition} onChange={(event) => update("condition", event.target.value)} /></label>
            <label className="text-field"><span>Test Step Description *</span><textarea rows={6} value={draft.steps} onChange={(event) => update("steps", event.target.value)} /></label>
            <label className="text-field"><span>Expected Result *</span><textarea rows={6} value={draft.expected} onChange={(event) => update("expected", event.target.value)} /></label>
            <div className="result-editor-actions"><button type="button" className="secondary-button" onClick={cancelCaseDetailsEdit} disabled={saving}>ยกเลิกการแก้ไข</button><button type="button" className="primary-button" onClick={() => void saveCaseDetails()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}บันทึก Test Case</button></div>
          </section> : null}
          <fieldset className="read-only-fieldset" disabled={readOnly}>
          <div className="form-section-title"><span>{readOnly ? "ข้อมูลผลการทดสอบ" : "บันทึกผลการทดสอบ"}</span>{!readOnly && <span className="required-note">* จำเป็น</span>}</div>
          <div className="two-column-fields">
            <label><span>Platform</span><input value={draft.platform} onChange={(event) => update("platform", event.target.value)} placeholder="เช่น Mobile, Web, iOS/Android" /></label>
            <label><span>Environment</span><input value={draft.environment} onChange={(event) => update("environment", event.target.value)} placeholder="เช่น UAT, SIT, Production" /></label>
          </div>
          <div className="two-column-fields">
            <label><span>Device</span><select value={draft.device} onChange={(event) => update("device", event.target.value)}><option value="">เลือก Device</option><option value="iOS">iOS</option><option value="Android">Android</option><option value="iOS/Android">iOS/Android</option></select></label>
            <label><span>App version</span><input value={draft.appVersion} onChange={(event) => update("appVersion", event.target.value)} placeholder="Build number" /></label>
          </div>
          <label className="text-field"><span>ผู้ทดสอบ</span><input value={draft.executedBy} onChange={(event) => update("executedBy", event.target.value)} placeholder={currentUserName || "ชื่อผู้ทดสอบ"} /></label>
          <label className="text-field"><span>Test data</span><input value={draft.testData} onChange={(event) => update("testData", event.target.value)} /></label>
          <label className="text-field"><span>หมายเหตุ / Actual result</span><textarea rows={4} value={draft.remark} onChange={(event) => update("remark", event.target.value)} placeholder="บันทึกสิ่งที่พบระหว่างการทดสอบ..." /></label>
          {additionalCustomFields.length > 0 && <section className="dynamic-sheet-fields">
            <div className="result-form-heading"><div><span>ข้อมูลเพิ่มเติมจาก Google Sheets</span><small>แสดงเฉพาะฟิลด์ที่ไม่ซ้ำกับบันทึกผลการทดสอบ และซิงค์กลับไปยังตำแหน่งเดิมในชีต</small></div><strong>{additionalCustomFields.length} fields</strong></div>
            {(["testcase", "detail"] as const).map((sourceType) => {
              const fields = additionalCustomFields.filter((field) => field.source === sourceType);
              if (!fields.length) return null;
              return <div className="dynamic-field-group" key={sourceType}><h3>{sourceType === "testcase" ? "จาก tab Testcase" : `จาก tab ${displayTestCaseId(draft)}`}</h3><div className="dynamic-field-grid">{fields.map((field) => <label className="text-field" key={field.key}><span>{field.label}</span>{field.value.includes("\n") || field.value.length > 100 ? <textarea rows={3} value={field.value} onChange={(event) => updateCustomField(field.key, event.target.value)} /> : <input value={field.value} onChange={(event) => updateCustomField(field.key, event.target.value)} />}</label>)}</div></div>;
            })}
          </section>}
          </fieldset>
          {renderResults(sharedSheets.length ? draft.results ?? [] : draft.stepDefinitions?.length ? orderedStepResults(draft).filter(result => !draft.stepDefinitions!.some(step => step.id === result.stepId)) : draft.results ?? [], !sharedSheets.length && draft.stepDefinitions?.length ? "ผลที่ยังไม่ได้ผูกกับ Step" : "Result Testing")}
          {focusedSheetName && loadingSheetDetails && <div className="result-preview-list sheet-result-evidence"><SheetContentShimmer /></div>}
          {focusedSheetName && !loadingSheetDetails && source && focusedEvidence.sheet && focusedEvidence.remaining > 0 && <div className="result-preview-list sheet-result-evidence"><div className="result-sheet-heading"><span>รูปหลักฐานเพิ่มเติมจาก {focusedSheetName}</span><strong>{focusedEvidence.remaining} รูป</strong></div>{source.bufferLoaded ? <ResultSheetViewer source={source} sheet={focusedEvidence.sheet} imagesOnly displayedEvidence={displayedResultEvidence} contentOverride={focusedEvidence.content} /> : <SheetContentShimmer />}</div>}
          {!readOnly && !showResultEntry && !editingResultId && !showDefectEntry && !editingDefectId && <div className="entry-type-actions"><button type="button" className="primary-button open-result-button" onClick={() => { resetResultForm(); setShowResultEntry(true); }}><PlusIcon />Add Result</button><button type="button" className="secondary-button add-defect-button" onClick={() => { resetResultForm(); setShowDefectEntry(true); }}><CircleAlert size={16} />Add Defect</button></div>}
          {showResultEntry && <div className="result-entry-block result-entry-highlight">
            <div className="result-form-heading"><div><span>{`เพิ่ม Result ให้ ${displayTestCaseId(draft)}`}</span><small>Result ใหม่จะแสดงบนสุดของรายการ</small></div><strong>{draft.results?.length ?? 0} results</strong></div>
            {renderResultFields("บันทึก Result รายการนี้", resetResultForm)}
          </div>}
          {showDefectEntry && <div className="result-entry-block defect-entry"><div className="result-form-heading"><div><span>{`เพิ่ม Defect ให้ ${displayTestCaseId(draft)}`}</span><small>Defect นี้จะผูกกับ Test case โดยตรง</small></div><strong>{draft.defects?.length ?? 0} defects</strong></div>{renderDefectFields("บันทึก Defect รายการนี้", resetResultForm)}</div>}
          {(draft.defects?.length ?? 0) > 0 && <div className="result-preview-list defect-preview-list"><div className="result-sheet-heading"><span>Defects ของ Test case</span><strong>{draft.defects?.length} รายการ</strong></div>{draft.defects?.map((defect, index) => <article key={defect.id} className={editingDefectId === defect.id ? "editing" : ""}><header><strong>Defect {index + 1}: {defect.title}</strong><span className="status-badge status-failed">{defect.status}</span><time>{formatFlexibleDate(defect.createdAt)}</time>{!readOnly && editingDefectId !== defect.id && <><button type="button" className="secondary-button result-edit-button" onClick={() => editDefect(defect)}>แก้ไข</button><button type="button" className="danger-button result-delete-button" disabled={savingResult} onClick={() => void deleteDefect(defect)}><Trash2 size={13} />ลบ</button></>}</header>{editingDefectId === defect.id ? <div className="result-entry-block inline-result-editor">{renderDefectFields("บันทึกการแก้ไข Defect", resetResultForm)}</div> : <>{defect.description && <p>{defect.description}</p>}{defect.apiResponse && <details><summary>API response</summary><pre>{defect.apiResponse}</pre></details>}{defect.log && <details><summary>Log</summary><pre>{defect.log}</pre></details>}<ImageViewerGallery className="drive-evidence-gallery result-evidence-gallery" images={evidenceViewerImages(defect.evidence)} />{defect.jiraUrl && <a className="secondary-button" href={defect.jiraUrl} target="_blank" rel="noreferrer">เปิด Jira</a>}</>}</article>)}</div>}
          {!focusedSheetName && remainingResultSheets.length > 0 && <div className="result-sheet-block">
            <div className="result-sheet-heading"><span>ผลและหลักฐานจาก Sheets</span><strong>{remainingResultSheets.length} sheets · {evidenceCount} รูป</strong></div>
            {loadingSheetDetails || loadingWorkbook ? <SheetContentShimmer /> : <>{remainingResultSheets.length ? <div className="result-sheet-list">{remainingResultSheets.map((sheet) => <button className={viewingSheet?.path === sheet.path ? "active" : ""} onClick={() => { if (source?.bufferLoaded) return setViewingSheet(sheet); setLoadingWorkbook(true); void onEnsureWorkbook().then(() => setViewingSheet(sheet)).catch((reason) => setError(reason instanceof Error ? reason.message : "โหลดไฟล์ต้นฉบับไม่สำเร็จ")).finally(() => setLoadingWorkbook(false)); }} key={sheet.path}><FileSpreadsheet size={16} /><span><strong>{sheet.name}</strong><small>{sheet.imageCount ? `${sheet.imageCount} รูปหลักฐาน` : "ไม่มีรูปในชีต"}</small></span><ChevronRight size={15} /></button>)}</div> : <p className="no-result-sheet">ไม่พบชีตผลลัพธ์ที่อ้างอิง {value.id}</p>}{source?.bufferLoaded && remainingResultSheets.map(sheet => <ResultSheetViewer key={sheet.path} source={source} sheet={sheet} imagesOnly displayedEvidence={displayedResultEvidence} />)}{viewingSheet && remainingResultSheets.some(sheet => sheet.path === viewingSheet.path) && source?.bufferLoaded && <ResultSheetViewer key={viewingSheet.path} source={source} sheet={viewingSheet} displayedEvidence={displayedResultEvidence} showImages={false} />}</>}
          </div>}
          <label className="field-label">สถานะผลทดสอบ</label>
          {readOnly || draft.stepDefinitions?.length ? <><StatusBadge status={draft.status} />{!!draft.stepDefinitions?.length && <small>คำนวณจากสถานะของทุก Step</small>}</> : <div className="status-picker">
            {TEST_STATUSES.map((status) => (
              <button type="button" key={status} className={draft.status === status ? "selected" : ""} onClick={() => setDraft((current) => ({ ...current, status }))}>
                <span className={`picker-dot ${statusMeta[status].className}`} />{statusMeta[status].label}
              </button>
            ))}
          </div>}
        </div>
        {error && <p className="form-error"><CircleAlert size={16} />{error}</p>}
        <footer className="drawer-footer"><button className="secondary-button" onClick={onClose} disabled={saving}>{readOnly ? "กลับไป Test cases" : "ยกเลิก"}</button>{!readOnly && <button className="primary-button" onClick={() => void save()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}บันทึกผล</button>}</footer>
      </aside>
    </div>
  );
}

export function QaWorkspace({
  configured,
  initialProjects,
  projectsError,
  groupId,
  selectedProjectId,
  activePage,
  currentUser,
  testCaseId,
  sheetName,
  planningSprint,
  sprintProjectData,
  canCreateProject = false,
}: {
  configured: boolean;
  initialProjects: Project[];
  projectsError: string;
  groupId: string;
  selectedProjectId?: string;
  activePage: WorkspacePage;
  currentUser: CurrentUser | null;
  testCaseId?: string;
  sheetName?: string;
  planningSprint?: Sprint;
  sprintProjectData?: SprintDashboardData;
  canCreateProject?: boolean;
}) {
  const router = useRouter();
  const cachedWorkspace = selectedProjectId ? workspaceNavigationCache.get(selectedProjectId) : undefined;
  const [projects, setProjects] = useState(initialProjects);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const scopedSprintId = planningSprint?.id ?? selectedProject?.sprintId;
  const scopedYear = planningSprint?.year ?? selectedProject?.year;
  const sprintBase = scopedSprintId && scopedYear ? `/groups/${groupId}/years/${scopedYear}/sprints/${scopedSprintId}` : "";
  const projectsHref = sprintBase ? `${sprintBase}/projects` : `/groups/${groupId}/years`;
  const canEditProject = selectedProject?.canEdit === true;
  const canManageProject = selectedProject?.canManage === true;
  const requiresDetailedGoogleData = Boolean((testCaseId || sheetName) && selectedProject?.googleSheetId);
  const [workspaceCases, setCases] = useState<TestCase[]>(() => cachedWorkspace?.cases ?? []);
  const [source, setSource] = useState<WorkbookSource | null>(() => cachedWorkspace?.source ?? null);
  const [sheetMappings, setSheetMappings] = useState<ProjectSheetMapping[]>(() => cachedWorkspace?.sheetMappings ?? []);
  const cases = useMemo(() => workspaceCasesForRegister(workspaceCases, source?.sheets ?? [], sheetMappings), [workspaceCases, source, sheetMappings]);
  const [hasLoadedSheetMappings, setHasLoadedSheetMappings] = useState(cachedWorkspace?.hasLoadedSheetMappings ?? false);
  const [hasDetailedGoogleData, setHasDetailedGoogleData] = useState(cachedWorkspace?.hasDetailedGoogleData ?? false);
  const [hasGoogleWorkbook, setHasGoogleWorkbook] = useState(cachedWorkspace?.hasGoogleWorkbook ?? false);
  const [loadingWorkspace, setLoadingWorkspace] = useState(Boolean(selectedProjectId && (!cachedWorkspace || !cachedWorkspace.hasLoadedSheetMappings || (requiresDetailedGoogleData && !cachedWorkspace.hasDetailedGoogleData))));
  const [workspaceError, setWorkspaceError] = useState("");
  const {view:caseTableView,update:updateCaseTableView}=useCaseTableView(currentUser?.id ?? '',selectedProjectId ?? '');
  const search=caseTableView.query;
  const statusFilter=caseTableView.status;
  const setSearch=(query:string)=>updateCaseTableView({query});
  const setStatusFilter=(status:TestStatus|'All')=>updateCaseTableView({status});
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [assignmentData,setAssignmentData]=useState<AssignmentData|null>(null);
  const [assignmentProjectId,setAssignmentProjectId]=useState('');
  const [assignmentVersion,setAssignmentVersion]=useState(0);
  const [assignmentSelection,dispatchAssignmentMode]=useReducer(assignmentModeReducer,{projectId:'',keys:[],editing:false});
  const editingAssignments=isAssignmentEditing(assignmentSelection,selectedProjectId,canEditProject);
  const setAssignmentSelection=(selection:{projectId:string;keys:string[]})=>dispatchAssignmentMode({type:'select',...selection});
  const [showCaseAssignment,setShowCaseAssignment]=useState(false);
  const selectedAssignmentKeys=assignmentSelection.projectId===selectedProjectId ? assignmentSelection.keys : [];
  useEffect(()=>{
    if(!selectedProjectId || activePage!=='test-cases' || testCaseId || sheetName) return;
    let active=true;
    void getTestCaseAssignments(selectedProjectId).then(data=>{if(active){setAssignmentData(data);setAssignmentProjectId(selectedProjectId);}}).catch(()=>{if(active){setAssignmentData({team:[],assignments:[],cases:[],error:'โหลดผู้รับผิดชอบไม่สำเร็จ กรุณาลองใหม่'});setAssignmentProjectId(selectedProjectId);}});
    return ()=>{active=false;};
  },[selectedProjectId,activePage,testCaseId,sheetName,assignmentVersion]);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft | null>(null);
  const projectDraftKey = `qa-project-draft:${currentUser?.id ?? ""}:${groupId}:${planningSprint?.id ?? ""}`;
  useEffect(() => {
    if (!canCreateProject) return;
    const query = new URLSearchParams(window.location.search);
    if (!query.has("googleAuth") && !query.has("googleAuthError")) return;
    try {
      const draft = JSON.parse(sessionStorage.getItem(projectDraftKey) ?? "null") as ProjectDraft | null;
      if (!draft || [draft.name, draft.description, draft.environment, draft.googleSheetUrl].some(value => typeof value !== "string")) return;
      queueMicrotask(() => { setProjectDraft(draft); setShowProjectDialog(true); });
    } catch { /* An invalid or unavailable draft must not stop the Projects page. */ }
  }, [canCreateProject, projectDraftKey]);
  const [showGoogleSheetDialog, setShowGoogleSheetDialog] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [exporting, setExporting] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [syncConflictState, setSyncConflictState] = useState<{ operation: "push"; conflicts: CaseConflict[]; googleCases: TestCase[] } | null>(null);
  const [pullingGoogle, setPullingGoogle] = useState(Boolean(selectedProjectId && activeProjectImports.has(selectedProjectId)));
  const [checkingSheetsProject, setCheckingSheetsProject] = useState<string | null>(() => selectedProject?.googleSheetId && canEditProject ? selectedProject.id : null);
  const checkingSheets = checkingSheetsProject === selectedProjectId;
  const [sheetCheckErrorProject, setSheetCheckErrorProject] = useState<string | null>(null);
  const sheetCheckFailed = sheetCheckErrorProject === selectedProjectId;
  const autoImportAttempted = useRef(new Set<string>());
  const [sheetRowLoads, setSheetRowLoads] = useState<Record<string, RowLoadState>>(cachedWorkspace?.sheetRowLoads ?? {});
  const [sheetLoadProgress, setSheetLoadProgress] = useState<Record<string, SheetImportProgress>>(cachedWorkspace?.sheetLoadProgress ?? {});
  const [rowLoadProjectId, setRowLoadProjectId] = useState<string | null>(selectedProjectId ?? null);
  const activeSheetRowLoads = rowLoadProjectId === selectedProjectId ? sheetRowLoads : {};
  const locallyCreatedCaseIds = useRef(new Set<string>());
  const [loadingSheetPreview, setLoadingSheetPreview] = useState(false);
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(cachedWorkspace?.hasUnsyncedChanges ?? false);
  const restoredTestCaseScrollKey = useRef("");
  const testCaseScrollKey = selectedProjectId ? `qa-test-cases-scroll:${selectedProjectId}` : "";
  const rememberTestCasePosition = () => {
    if (testCaseScrollKey) sessionStorage.setItem(testCaseScrollKey, String(window.scrollY));
  };
  const openTestCaseDetail = (path: string) => {
    rememberTestCasePosition();
    restoredTestCaseScrollKey.current = "";
    router.push(path, { scroll: false });
  };
  const returnToTestCases = () => {
    if (!selectedProject) return;
    router.push(`/groups/${groupId}/projects/${selectedProject.id}/test-cases`, { scroll: false });
  };
  async function ensureWorkbookLoaded() {
    if (!selectedProject || !source) throw new Error("ไม่พบไฟล์ต้นฉบับของ Project");
    if (source.bufferLoaded) return source;
    const buffer = !source.id && selectedProject.googleSheetId ? await getGoogleWorkbook()
      : await getProjectWorkbook(`${selectedProject.id}:${source.id}`, () => loadProjectWorkbook(selectedProject.id, source.id));
    const loadedSource = { ...source, buffer, bufferLoaded: true };
    setSource(loadedSource);
    const cached = workspaceNavigationCache.get(selectedProject.id);
    if (cached) workspaceNavigationCache.set(selectedProject.id, { ...cached, source: loadedSource });
    return loadedSource;
  }
  const getGoogleWorkbook = useCallback((refresh = false, expectedRevision?: string) => {
    if (!selectedProject?.googleSheetId) return Promise.reject(new Error("ไม่พบ Google Sheets ของ Project"));
    const key = `${selectedProject.id}:google:${selectedProject.googleSheetId}:${expectedRevision ?? "live"}`;
    if (refresh) clearProjectWorkbook(key);
    return getProjectWorkbook(key, async () => {
      return withImportTimeout(async signal => {
        const response = await fetch(`/api/projects/${selectedProject.id}/google-sheet/workbook${expectedRevision ? `?expectedRevision=${encodeURIComponent(expectedRevision)}` : ""}`, { cache: "no-store", signal });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          if (response.status === 401 && data?.authUrl) continueGoogleAuthorization(data.authUrl);
          throw new Error(data?.error ?? "โหลดรูปหลักฐานจาก Google Sheets ไม่สำเร็จ");
        }
        return response.arrayBuffer();
      }, 180_000, "ดาวน์โหลดไฟล์ต้นฉบับเพื่อตรวจรูป");
    });
  }, [selectedProject]);
  const currentEnvironment = workspaceEnvironment(cases, selectedProject?.environment);
  const evidenceReadiness = approvalEvidenceReadiness(readSheetImportState(source?.sheetImport, selectedProject?.googleSheetId), workspaceCases, source?.sheets.map(sheet => sheet.name));
  const importAction = sheetImportAction(source?.sheetImport);
  const showProjectImportProgress = !loadingWorkspace && !!selectedProject?.googleSheetId && (pullingGoogle || !!source?.sheetImport);

  useEffect(() => {
    if (!testCaseScrollKey || activePage !== "test-cases" || testCaseId || sheetName || loadingWorkspace) return;
    if (restoredTestCaseScrollKey.current === testCaseScrollKey) return;
    restoredTestCaseScrollKey.current = testCaseScrollKey;
    const savedPosition = Number(sessionStorage.getItem(testCaseScrollKey));
    if (!Number.isFinite(savedPosition) || savedPosition <= 0) return;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: savedPosition, behavior: "auto" }));
    return () => cancelAnimationFrame(frame);
  }, [activePage, loadingWorkspace, sheetName, testCaseId, testCaseScrollKey]);

  const counts = useMemo(() => Object.fromEntries(TEST_STATUSES.map((status) => [status, cases.filter((item) => !isProjectDefectSheet(item.id) && item.status === status).length])) as Record<TestStatus, number>, [cases]);
  const testCaseTotal = Object.values(counts).reduce((total, count) => total + count, 0);
  const completed = counts.Pass + counts.Failed + counts.Skip;
  const progress = testCaseTotal ? Math.round((completed / testCaseTotal) * 100) : 0;
  const testingFinished = testCaseTotal > 0 && completed === testCaseTotal;
  const tableCases=useMemo(()=>cases.filter(item=>!isProjectDefectSheet(item.id)),[cases]);
  const caseTableColumns=useMemo(()=>collectCaseColumns(tableCases),[tableCases]);
  const selectedCaseTableColumns=useMemo(()=>visibleCaseColumns(caseTableColumns,caseTableView.selected),[caseTableColumns,caseTableView.selected]);
  const filteredCases=useMemo(()=>filterCaseTable(tableCases,caseTableColumns,caseTableView,CASE_ADVANCED_FILTERS_ENABLED),[tableCases,caseTableColumns,caseTableView]);
  const allDefects = useMemo(() => collectProjectDefects(cases.flatMap(testCase => (testCase.defects ?? []).map(defect => ({ ...defect, testCaseReference: defect.testCaseReference || testCase.id }))), (source?.sheets ?? []).flatMap(sheet => sheet.defects ?? [])), [cases, source]);
  const defectSummary = useMemo(() => summarizeProjectDefects(allDefects), [allDefects]);
  const sheetResolution = useMemo(() => resolveSheetAssociations(
    (source?.sheets ?? []).filter((sheet) => sheet.name.trim().toLowerCase() !== "testcase" && !isProjectDefectSheet(sheet.name)),
    cases,
    sheetMappings,
  ), [cases, sheetMappings, source]);
  const caseSheetAliases = useMemo(() => {
    const aliases = new Map<string, string[]>();
    for (const association of sheetResolution.associations) {
      const identity = testCaseIdentity(association.testCase.id);
      if (association.sheet.name.trim().toUpperCase() === association.testCase.id.trim().toUpperCase()) continue;
      aliases.set(identity, [...(aliases.get(identity) ?? []), association.sheet.name]);
    }
    return aliases;
  }, [sheetResolution.associations]);
  const associatedSheetsByCase = useMemo(() => {
    const sheets = new Map<string, WorkbookSheet[]>();
    for (const association of sheetResolution.associations) {
      const identity = testCaseIdentity(association.testCase.id);
      sheets.set(identity, [...(sheets.get(identity) ?? []), association.sheet]);
    }
    return sheets;
  }, [sheetResolution.associations]);
  const otherSheets = useMemo(() => {
    const invalidSheets = sheetResolution.invalidMappings.map((item) => item.sheet);
    return [...sheetResolution.unmapped, ...invalidSheets].filter((sheet, index, all) => all.findIndex((item) => item.path === sheet.path) === index);
  }, [sheetResolution.invalidMappings, sheetResolution.unmapped]);
  const filteredCaseRows = useMemo(() => filteredCases.flatMap((item) => {
    const aliases = caseSheetAliases.get(testCaseIdentity(item.id)) ?? [];
    return aliases.length ? aliases.map((sheetAlias) => ({ item, sheetAlias })) : [{ item, sheetAlias: "" }];
  }), [caseSheetAliases, filteredCases]);
  function openRegisterRow({item,sheetAlias}:CaseRegisterRow) {
    if(!selectedProject) return;
    const shared=sheetAlias && sheetResolution.associations.filter(association=>association.sheet.name===sheetAlias).length>1;
    const path=sheetAlias && !shared ? `/groups/${groupId}/projects/${selectedProject.id}/sheets/${encodeURIComponent(sheetAlias)}` : `/groups/${groupId}/projects/${selectedProject.id}/test-cases/${encodeURIComponent(item.id)}`;
    openTestCaseDetail(path);
  }
  const assignmentRowKey=(id:string,sheetAlias:string)=>JSON.stringify([id,sheetAlias]);
  const assignmentTargets=cases.flatMap(item=>{
    const aliases=caseSheetAliases.get(testCaseIdentity(item.id)) ?? [];
    return (aliases.length ? aliases : ['']).filter(alias=>selectedAssignmentKeys.includes(assignmentRowKey(item.id,alias))).map(alias=>({caseId:item.recordId,testcaseKey:item.id,sourceSheet:alias}));
  });
  function toggleAssignment(id:string,alias:string,checked:boolean) {
    const key=assignmentRowKey(id,alias);
    setAssignmentSelection({projectId:selectedProjectId ?? '',keys:checked ? [...new Set([...selectedAssignmentKeys,key])] : selectedAssignmentKeys.filter(k=>k!==key)});
  }
  function assigneeNames(item:TestCase,alias:string) {
    if(assignmentProjectId!==selectedProjectId || assignmentData?.error) return '';
    const recordId=item.recordId || assignmentData?.cases.find(c=>c.testcase_key===item.id)?.id;
    return assignmentData?.assignments.filter(a=>a.test_case_id===recordId && a.source_sheet===alias).map(a=>assignmentData.team.find(m=>m.userId===a.user_id)?.name ?? 'สมาชิกเดิม').join(', ') ?? '';
  }
  const activeSelectedCase = testCaseId
    ? cases.find((item) => item.id.toUpperCase() === decodeURIComponent(testCaseId).toUpperCase()) ?? null
    : selectedCase;
  const activeSheet = sheetName ? source?.sheets.find((item) => item.name === decodeURIComponent(sheetName)) ?? source?.sheets.find((item) => item.name.trim() === decodeURIComponent(sheetName).trim()) ?? null : null;
  const activeSheetAssociation = activeSheet ? sheetResolution.associations.find((association) => association.sheet.path === activeSheet.path) : undefined;
  const activeInvalidMapping = activeSheet ? sheetResolution.invalidMappings.find((item) => item.sheet.path === activeSheet.path)?.mapping : undefined;
  const activeSheetCase = activeSheetAssociation?.testCase ?? workspaceCases.find(item => item.sourceSheetName === activeSheet?.name || item.id === activeSheet?.name || (!cases.some(registered => registered.id === item.id) && item.results?.some(result => result.sourceSheetName === activeSheet?.name))) ?? null;
  const importedSheetResult = useMemo<TestResult | null>(() => {
    if (!activeSheet || !source?.bufferLoaded || loadingSheetPreview) return null;
    try {
      const content = readWorkbookSheet(source, activeSheet);
      const cells = content.cells.filter((cell) => cell.value.trim());
      if (!cells.length && !content.images.length) return null;
      return {
        id: `SHEET-${activeSheet.name}`,
        status: activeSheetCase?.status ?? "Not Start",
        actualResult: cells.map((cell) => `${cell.ref}: ${cell.value}`).join("\n"),
        apiResponse: "",
        log: "",
        evidence: [],
        customFields: cells.map((cell, index) => ({ key: `sheet:${activeSheet.name}:${cell.ref}`, label: cell.ref, value: cell.value, column: index })),
        sourceSheetName: activeSheet.name,
        createdAt: "",
      };
    } catch {
      return null;
    }
  }, [activeSheet, activeSheetCase, loadingSheetPreview, source]);
  const displayedSheetCase: TestCase | null = activeSheetCase && activeSheet ? {
    ...activeSheetCase,
    results: (() => { const results = (activeSheetCase.results ?? []).filter((result) => !result.sourceSheetName || result.sourceSheetName === activeSheet.name); return results.length || !importedSheetResult ? results : [importedSheetResult]; })(),
    defects: (activeSheetCase.defects ?? []).filter((defect) => !defect.sourceSheetName || defect.sourceSheetName === activeSheet.name),
  } : activeSheet ? {
    id: activeSheet.name,
    sourceRow: activeSheet.order + 1,
    platform: "",
    condition: "",
    scenario: "",
    name: activeSheet.name,
    steps: "",
    expected: "",
    status: "Not Start",
    device: "",
    testData: "",
    appVersion: "",
    environment: selectedProject?.environment ?? "",
    resultReference: activeSheet.name,
    executedBy: "",
    executedDate: "",
    executedTime: "",
    remark: `นำเข้าจาก tab ${activeSheet.name}`,
    evidence: [],
    results: importedSheetResult ? [importedSheetResult] : [],
    defects: [],
  } : null;

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function updateSheetMapping(sheet: WorkbookSheet, mapping: ProjectSheetMapping | null) {
    if (sheet.sheetId == null) return;
    setSheetMappings((current) => mapping
      ? [...current.filter((item) => item.sheetId !== sheet.sheetId), mapping]
      : current.filter((item) => item.sheetId !== sheet.sheetId));
    flash(mapping ? `ผูก ${sheet.name} กับ ${mapping.testcaseKey} แล้ว` : `ยกเลิกการผูก ${sheet.name} แล้ว`);
  }

  useEffect(() => {
    if (!selectedProject) return;
    const cached = workspaceNavigationCache.get(selectedProject.id);
    const needsDetailedData = Boolean((testCaseId || sheetName) && selectedProject.googleSheetId);
    const upgradeCachedTemplate = cached && needsStepTemplateRefresh(cached.cases, cached.source);
    if (cached && cached.hasLoadedSheetMappings && !needsDetailedData) return;
    if (cached?.hasLoadedSheetMappings && needsDetailedData && cached.source && !upgradeCachedTemplate) {
      const names = selectDetailSheets(cached.source.sheets, sheetName
        ? { sheetName: decodeURIComponent(sheetName) }
        : { testcaseId: decodeURIComponent(testCaseId!) }).map(sheet => sheet.name);
      const loadKeys = caseDetailLoadKeys(names, decodeURIComponent(testCaseId ?? ""));
      if (canReuseSheetDetails(loadKeys, cached.sheetRowLoads, cached.source.bufferLoaded || !names.length || canRenderStoredCaseDetails(cached.source, Boolean(testCaseId || cached.cases.some(item=>item.results?.some(result=>result.sourceSheetName===decodeURIComponent(sheetName ?? "")))) ))) return;
    }
    let active = true;
    const releaseDetailRefresh = needsDetailedData ? beginProjectDetailRefresh(selectedProject.id) : () => {};
    queueMicrotask(() => { if (active) setLoadingWorkspace(!cached); });
    const workspaceRequest = cached ? Promise.resolve({ cases: cached.cases, source: cached.source }) : loadProjectWorkspace(selectedProject.id, { includeWorkbook: false });
    const googleRequest = selectedProject.googleSheetId
      ? workspaceRequest.then(async workspace => {
          const saved = readSheetImportState(workspace.source?.sheetImport, selectedProject.googleSheetId);
          const names = needsDetailedData && workspace.source ? selectDetailSheets(workspace.source.sheets, sheetName
              ? { sheetName: decodeURIComponent(sheetName) } : { testcaseId: decodeURIComponent(testCaseId!) }).map(sheet => sheet.name) : [];
          const detailsLoaded = Boolean(saved && sheetRowState(caseDetailLoadKeys(names, decodeURIComponent(testCaseId ?? "")), saved.states) === "loaded");
          if (!shouldFetchGoogleWorkspace(Boolean(workspace.source || workspace.cases.length), needsDetailedData, detailsLoaded,
            Boolean(saved?.refreshRequired || needsStepTemplateRefresh(workspace.cases, workspace.source)))) return null;
          if (active && needsDetailedData) setLoadingSheetPreview(true);
          const sourceRevision = needsDetailedData ? await readSourceRevision(selectedProject.id) : undefined;
          const requestedSheets = testCaseId && names.length ? `?${names.map(name => `sheet=${encodeURIComponent(name)}`).join('&')}` : '';
          const response = await fetch(`/api/projects/${selectedProject.id}/google-sheet${requestedSheets || (sheetName ? `?sheet=${encodeURIComponent(decodeURIComponent(sheetName))}` : testCaseId ? `?testcase=${encodeURIComponent(decodeURIComponent(testCaseId))}` : "?summary=1")}`, { cache: "no-store" });
          const data = await response.json();
          if (response.status === 401 && data.authUrl) {
            continueGoogleAuthorization(data.authUrl);
            return null;
          }
          if (!response.ok) throw new Error(data.error ?? "โหลด Google Sheet ไม่สำเร็จ");
          const incoming = data as { cases: TestCase[]; sheets: WorkbookSource["sheets"]; coverSnapshot?: WorkbookSource["coverSnapshot"]; documentType?: WorkbookSource["documentType"] };
          const aligned = alignRegisterCaseIdentities(workspace.cases, incoming.cases);
          const ids = new Map(incoming.cases.map((item, index) => [item.id, aligned[index].id]));
          incoming.cases = aligned;
          incoming.sheets = incoming.sheets.map(sheet => ({ ...sheet, testCaseIds: sheet.testCaseIds.map(id => ids.get(id) ?? id), definitionCaseIds: sheet.definitionCaseIds?.map(id => ids.get(id) ?? id) }));
          return needsDetailedData ? { ...incoming, sourceRevision, cases: scopeGoogleDetailCases(workspace.cases, incoming.cases) } : { ...incoming, sourceRevision };
        })
      : Promise.resolve(null);
    const mappingsRequest = cached?.hasLoadedSheetMappings ? Promise.resolve(cached.sheetMappings) : selectedProject.googleSheetId
      ? fetch(`/api/projects/${selectedProject.id}/sheet-mappings`, { cache: "no-store" }).then(async (response) => {
          const data = await response.json() as { mappings?: ProjectSheetMapping[]; error?: string };
          if (!response.ok) throw new Error(data.error ?? "โหลด Sheet mapping ไม่สำเร็จ");
          return data.mappings ?? [];
        })
      : Promise.resolve([] as ProjectSheetMapping[]);
    void mappingsRequest.then(mappings => {
      if (active) { setSheetMappings(mappings); setHasLoadedSheetMappings(true); }
    }).catch(reason => {
      if (active) setWorkspaceError(current => [current, reason instanceof Error ? reason.message : "โหลด Sheet mapping ไม่สำเร็จ"].filter(Boolean).join(" · "));
    });
    void workspaceReadyFirst(workspaceRequest, workspace => {
      if (!active) return;
      setCases(workspace.cases);
      setSource(workspace.source);
      const savedImport = readSheetImportState(workspace.source?.sheetImport, selectedProject.googleSheetId);
      setRowLoadProjectId(selectedProject.id);
      setSheetRowLoads(cached?.sheetRowLoads ?? savedImport?.states ?? {});
      setLoadingWorkspace(false);
    }, [googleRequest])
      .then(async ([workspaceResult, googleResult]) => {
        if (!active) return;
        if (workspaceResult.status === "rejected") throw workspaceResult.reason;
        const workspace = workspaceResult.value;
        const savedImport = readSheetImportState(workspace.source?.sheetImport, selectedProject.googleSheetId);

        const googleWorkspace = googleResult.status === "fulfilled" ? googleResult.value : null;
        if (googleWorkspace) {
          if (selectedProject.canEdit && workspace.source?.id && !sheetName && !testCaseId) {
            await cacheProjectDefectMetadata(selectedProject.id, googleWorkspace.sheets).catch(reason => {
              if (active) setWorkspaceError(`อ่าน Sheets ได้ แต่ยังบันทึก Defects ให้ Sprint ไม่สำเร็จ: ${reason instanceof Error ? reason.message : "กรุณาลองใหม่"}`);
            });
          }
          if (!active) return;
          setRowLoadProjectId(selectedProject.id);
          const loadedDetails = needsDetailedData ? selectDetailSheets(googleWorkspace.sheets, sheetName
            ? { sheetName: decodeURIComponent(sheetName) }
            : { testcaseId: decodeURIComponent(testCaseId!) }) : [];
          setSheetRowLoads(current => ({ ...current, Testcase: "loaded", ...Object.fromEntries(loadedDetails.map(sheet => [sheet.name, "loading" as RowLoadState])) }));
        }
        const mergedWorkspace = googleWorkspace
          ? mergeWorkspaceAndGoogleCases(workspace.cases, googleWorkspace.cases, currentUser?.name ?? "")
          : { cases: workspace.cases, localOnlyCases: [] as TestCase[] };
        const mergedCases = mergedWorkspace.cases;
        const localOnlyCases = mergedWorkspace.localOnlyCases;
        if (googleWorkspace) {
          setCases(current => mergeWorkspaceAndGoogleCases(current, googleWorkspace.cases, currentUser?.name ?? "").cases);
          setSource(workspace.source ? {
            ...workspace.source,
            documentType: googleWorkspace.documentType ?? workspace.source.documentType,
            coverSnapshot: googleWorkspace.coverSnapshot ?? workspace.source.coverSnapshot,
            sheets: mergeGoogleSheetsWithSource(workspace.source.sheets, googleWorkspace.sheets),
          } : {
            fileName: `${selectedProject.name}.xlsx`, buffer: new ArrayBuffer(0), bufferLoaded: false,
            sheetName: "Testcase", sheetPath: "", columns: {}, sheets: googleWorkspace.sheets,
            coverSnapshot: googleWorkspace.coverSnapshot,
            documentType: googleWorkspace.documentType,
          });
          setHasUnsyncedChanges(Boolean(localOnlyCases.length));
        }
        if (needsDetailedData && googleResult.status === "fulfilled" && googleWorkspace) setHasDetailedGoogleData(true);
        if (googleResult.status === "rejected") {
          const message = googleResult.reason instanceof Error ? googleResult.reason.message : "โหลด Google Sheet ไม่สำเร็จ";
          setWorkspaceError(`ยังโหลดข้อมูลเดิมได้ แต่ Google Sheets ยังไม่พร้อม: ${message}`);
        }
        if (needsDetailedData && !googleWorkspace && savedImport && !savedImport.refreshRequired && workspace.source) {
          const names = selectDetailSheets(workspace.source.sheets, sheetName
            ? { sheetName: decodeURIComponent(sheetName) } : { testcaseId: decodeURIComponent(testCaseId!) }).map(sheet => sheet.name);
          if (sheetRowState(caseDetailLoadKeys(names, decodeURIComponent(testCaseId ?? "")), savedImport.states) === "loaded") {
            setLoadingWorkspace(false);
            setLoadingSheetPreview(true);
            try {
              const storedDetails=canRenderStoredCaseDetails(workspace.source,Boolean(testCaseId || workspace.cases.some(item=>item.results?.some(result=>result.sourceSheetName===decodeURIComponent(sheetName ?? "")))));
              const buffer = workspace.source.bufferLoaded || storedDetails ? workspace.source.buffer
                : await getProjectWorkbook(`${selectedProject.id}:${workspace.source.id}`, () => loadProjectWorkbook(selectedProject.id, workspace.source!.id));
              if (active) {
                setSource({ ...workspace.source, buffer, bufferLoaded: workspace.source.bufferLoaded || !storedDetails });
                setHasGoogleWorkbook(true);
                setHasDetailedGoogleData(true);
              }
            } finally { if (active) setLoadingSheetPreview(false); }
          }
        }
        if (needsDetailedData && googleWorkspace) {
          const details = selectDetailSheets(googleWorkspace.sheets, sheetName
            ? { sheetName: decodeURIComponent(sheetName) }
            : { testcaseId: decodeURIComponent(testCaseId!) });
          setLoadingWorkspace(false);
          setLoadingSheetPreview(true);
          try {
            const loadKeys = caseDetailLoadKeys(details.map(sheet => sheet.name), decodeURIComponent(testCaseId ?? ""));
            await completeResultTabLoad(loadKeys, async () => {
              if (!details.length) {
                if (selectedProject.canEdit && workspace.source?.id) {
                  const sheetImport = await persistSheetImportState(selectedProject.id, workspace.source.id, selectedProject.googleSheetId, Object.fromEntries(loadKeys.map(key => [key, "loaded" as const])), savedImport?.complete ?? false);
                  if (active) setSource({ ...workspace.source, sheetImport });
                }
                return;
              }
              const workbookSource = await revisionBoundSource(googleWorkspace.sourceRevision ?? "", cached?.source,
                revision => getGoogleWorkbook(false, revision), bytes => importTestCases(bytes, `${selectedProject.name}.xlsx`).source,
                () => readSourceRevision(selectedProject.id));
              if (!active) return;
              let loadedSource = { ...workbookSource, sheets: mergeGoogleSheetsWithSource(workbookSource.sheets, googleWorkspace.sheets) };
              // Parse every requested tab before claiming that its evidence is available.
              for (const detail of details) {
                const sheet = loadedSource.sheets.find(sheet => sheet.name === detail.name);
                if (!sheet) throw new Error(`ไม่พบรูปแบบรายละเอียดของ ${detail.name}`);
                readWorkbookSheet(loadedSource, sheet);
              }
              const detailSource = { ...loadedSource, sheets: loadedSource.sheets.filter(sheet => details.some(detail => detail.name === sheet.name)) };
              const refreshedCases = refreshWorkbookStepEvidence(mergedCases,
                readWorkbookFreeformResults(detailSource, mergedCases), readWorkbookResultImages(detailSource, mergedCases));
              if (active) setCases(refreshedCases);
              if (selectedProject.canEdit) {
                await completeProjectDetailWrites(refreshedCases.filter(item => item.id === decodeURIComponent(testCaseId ?? "") || item.results?.some(result => details.some(sheet => sheet.name === result.sourceSheetName)))
                  .map(item => persistTestCaseResult(selectedProject.id, item)));
                if (!active) return;
                const states = Object.fromEntries(loadKeys.map(key => [key, "loaded" as const]));
                if (!loadedSource.id) {
                  const saved = await persistImportedWorkbook(selectedProject.id, refreshedCases, {
                    ...loadedSource, documentType: googleWorkspace.documentType, sheetImport: revisionBoundCheckpoint(savedImport, selectedProject.googleSheetId, states, new Date().toISOString(), googleWorkspace.sourceRevision ?? ""),
                  }, false,"google-sheets");
                  loadedSource = { ...loadedSource, id: saved.source!.id, workbookStorage: saved.source!.workbookStorage, sourceOrigin: saved.source!.sourceOrigin, sheetImport: saved.source!.sheetImport };
                  clearProjectWorkbook(selectedProject.id);
                } else {
                  loadedSource = { ...loadedSource, sheetImport: await persistSheetImportState(selectedProject.id, loadedSource.id, selectedProject.googleSheetId, states, savedImport?.complete ?? false) };
                }
              }
              if (active) {
                setSource(loadedSource);
                setHasGoogleWorkbook(true);
              }
            }, (name, state) => { if (active) setSheetRowLoads(current => ({ ...current, [name]: state })); });
          } finally {
            if (active) setLoadingSheetPreview(false);
          }
        }
      })
      .catch((reason) => {
        if (!active) return;
        setWorkspaceError(reason instanceof Error ? reason.message : "โหลด Testcase ไม่สำเร็จ");
      })
      .finally(() => {
        releaseDetailRefresh();
        if (active) { setLoadingWorkspace(false); setLoadingSheetPreview(false); }
      });
    return () => { active = false; };
  }, [selectedProject, currentUser?.name, testCaseId, sheetName, getGoogleWorkbook]);

  useEffect(() => {
    if (!selectedProjectId || loadingWorkspace) return;
    workspaceNavigationCache.set(selectedProjectId, { cases: workspaceCases, source, sheetMappings, hasLoadedSheetMappings, hasUnsyncedChanges, hasDetailedGoogleData, hasGoogleWorkbook, sheetLoadProgress: rowLoadProjectId === selectedProjectId ? sheetLoadProgress : {}, sheetRowLoads: rowLoadProjectId === selectedProjectId ? sheetRowLoads : {} });
  }, [selectedProjectId, workspaceCases, source, sheetMappings, hasLoadedSheetMappings, hasUnsyncedChanges, hasDetailedGoogleData, hasGoogleWorkbook, loadingWorkspace, sheetRowLoads, sheetLoadProgress, rowLoadProjectId]);


  async function saveCase(next: TestCase) {
    if (!selectedProject) throw new Error("กรุณาเลือก Project");
    if (!canEditProject) throw new Error("Project นี้เปิดให้คุณดูอย่างเดียว");
    if (projectDetailRefreshPending(selectedProject.id)) throw new Error("กำลังโหลดรายละเอียดจาก Sheets กรุณารอให้เสร็จก่อนบันทึก");
    if (checkingSheets || activeProjectImports.has(selectedProject.id)) throw new Error("กำลังนำเข้าข้อมูล Project กรุณารอให้เสร็จก่อนบันทึก");
    const saved = await persistTestCaseResult(selectedProject.id, next);
    setCases((current) => {
      const matched = current.some((item) => (saved.recordId && item.recordId === saved.recordId) || item.id === activeSelectedCase?.id || item.id === saved.id);
      return matched ? current.map((item) => (saved.recordId && item.recordId === saved.recordId) || item.id === activeSelectedCase?.id || item.id === saved.id ? saved : item) : [...current, saved];
    });
    setSelectedCase(null);
    if (selectedProject.googleSheetId) {
      setHasUnsyncedChanges(true);
      flash(`บันทึก ${saved.id} แล้ว · รอซิงค์กลับ Google Sheets`);
    } else {
      flash(`บันทึกผล ${saved.id} ลง Supabase แล้ว`);
    }
    if (testCaseId) returnToTestCases();
  }

  async function createTestCase(next: TestCase) {
    if (!selectedProject) throw new Error("กรุณาเลือก Project");
    if (!canEditProject) throw new Error("Project นี้เปิดให้คุณดูอย่างเดียว");
    if (checkingSheets || activeProjectImports.has(selectedProject.id)) throw new Error("กำลังนำเข้าข้อมูล Project กรุณารอให้เสร็จก่อนบันทึก");
    const saved = await persistTestCaseResult(selectedProject.id, next);
    locallyCreatedCaseIds.current.add(saved.id);
    setCases((current) => [...current, saved].sort((a, b) => a.sourceRow - b.sourceRow));
    setSearch("");
    setStatusFilter("All");
    if (selectedProject.googleSheetId) {
      setHasUnsyncedChanges(true);
      flash(`เพิ่ม ${saved.id} แล้ว · กดซิงค์เพื่ออัปเดต Google Sheets`);
    } else {
      flash(`เพิ่ม ${saved.id} ลง Supabase แล้ว`);
    }
  }

  async function saveResult(next: TestCase) {
    if (!selectedProject) throw new Error("กรุณาเลือก Project");
    if (!canEditProject) throw new Error("Project นี้เปิดให้คุณดูอย่างเดียว");
    if (projectDetailRefreshPending(selectedProject.id)) throw new Error("กำลังโหลดรายละเอียดจาก Sheets กรุณารอให้เสร็จก่อนบันทึก");
    if (checkingSheets || activeProjectImports.has(selectedProject.id)) throw new Error("กำลังนำเข้าข้อมูล Project กรุณารอให้เสร็จก่อนบันทึก");
    const saved = await persistTestCaseResult(selectedProject.id, next);
    setCases((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]);
    setSelectedCase(saved);
    if (selectedProject.googleSheetId) setHasUnsyncedChanges(true);
    flash(`บันทึก Result ของ ${saved.id} ลง Supabase แล้ว`);
    return saved;
  }

  async function readSourceRevision(projectId: string, signal?: AbortSignal): Promise<string> {
    const response = await fetch(`/api/projects/${projectId}/google-sheet?revision=1`, { cache: "no-store", signal });
    const data = await response.json();
    if (response.status === 401 && data.authUrl) {
      continueGoogleAuthorization(data.authUrl);
      throw new Error("กรุณาเชื่อมต่อ Google เพื่ออัปเดตข้อมูลล่าสุด");
    }
    if (!response.ok || typeof data.revision !== "string" || !data.revision) throw new Error(data.error ?? "ตรวจการเปลี่ยนแปลงของ Sheets ไม่สำเร็จ");
    return data.revision;
  }

  async function pullFromGoogle(resume = false, checkedRevision?: string) {
    if (!selectedProject?.googleSheetId) return setShowGoogleSheetDialog(true);
    if (!canEditProject) return flash("Project นี้เปิดให้คุณดูอย่างเดียว");
    if (activeProjectImports.has(selectedProject.id)) return;
    activeProjectImports.add(selectedProject.id);
    setPullingGoogle(true);
    setWorkspaceError("");
    setRowLoadProjectId(selectedProject.id);
    const completedResultTabs = new Set<string>();
    const incompleteEvidenceTabs = new Set<string>();
    let previousImport = readSheetImportState(source?.sheetImport, selectedProject.googleSheetId);
    let importWorkspaceCases = workspaceCases;
    let importSource: WorkbookSource | null = null;
    let sourceDefinitionsReady = false;
    let savedSource = source;
    const importStates = initialSheetImportStates((source?.sheets ?? []).map(sheet => sheet.name), previousImport, resume);
    setSheetLoadProgress({ Testcase: { phase: "details" } });
    setSheetRowLoads(importStates);
    const progress: Record<string, SheetImportProgress> = { Testcase: { phase: "details" } };
    const updateProgress = (name: string, value: SheetImportProgress) => {
      progress[name] = { ...progress[name], ...value };
      setSheetLoadProgress({ ...progress });
      const cached = workspaceNavigationCache.get(selectedProject.id);
      if (cached) workspaceNavigationCache.set(selectedProject.id, { ...cached, sheetLoadProgress: { ...progress } });
      window.dispatchEvent(new CustomEvent("qa-project-import-stage", { detail: selectedProject.id }));
    };
    const publishProgress = (nextCases: TestCase[], nextSource: WorkbookSource | null, states: Record<string, RowLoadState>) => {
      workspaceNavigationCache.set(selectedProject.id, {
        cases: refreshRegisterCases(importWorkspaceCases, nextCases, { definitionsReady: sourceDefinitionsReady }).cases, source: nextSource ? { ...nextSource } : null, sheetMappings,
        hasLoadedSheetMappings, hasUnsyncedChanges: false, hasDetailedGoogleData: Boolean(nextSource?.bufferLoaded),
        hasGoogleWorkbook: Boolean(nextSource?.bufferLoaded), sheetRowLoads: { ...states }, sheetLoadProgress: { ...progress },
      });
      window.dispatchEvent(new CustomEvent("qa-project-import-progress", { detail: selectedProject.id }));
    };
    try {
      await waitForProjectDetailWrites(selectedProject.id);
      const latestWorkspace = await loadProjectWorkspace(selectedProject.id, { includeWorkbook: false });
      importWorkspaceCases = latestWorkspace.cases;
      savedSource = latestWorkspace.source && source && latestWorkspace.source.id === source.id && source.bufferLoaded
        ? { ...latestWorkspace.source, buffer: source.buffer, bufferLoaded: true }
        : latestWorkspace.source;
      previousImport = readSheetImportState(latestWorkspace.source?.sheetImport, selectedProject.googleSheetId);
      const sourceRevision = checkedRevision ?? await readSourceRevision(selectedProject.id);
      setSheetCheckErrorProject(null);
      // Never resume a workbook captured from a different source revision.
      resume = resume && savedSource?.sourceOrigin === "google-sheets" && !!previousImport?.sourceRevision
        && !sheetRefreshRequired(previousImport, sourceRevision);
      if (savedSource?.id) {
        const pendingCheckpoint = await persistSheetImportState(selectedProject.id, savedSource.id, selectedProject.googleSheetId, {}, false, true);
        savedSource = { ...savedSource, sheetImport: pendingCheckpoint };
        setSource(savedSource);
        publishProgress(importWorkspaceCases, savedSource, importStates);
      }
      const workbookPending = resume && previousImport && savedSource?.id
        ? getProjectWorkbook(`${selectedProject.id}:${savedSource.id}`, () => withImportTimeout(() => loadProjectWorkbook(selectedProject.id, savedSource!.id), 90_000, "โหลดไฟล์ต้นฉบับที่บันทึกไว้")) : getGoogleWorkbook(true, sourceRevision);
      // Attach a rejection handler immediately while the text requests run.
      void workbookPending.catch(() => {});
      const { response, data } = await withImportTimeout(async signal => {
        const response = await fetch(`/api/projects/${selectedProject.id}/google-sheet?summary=1`, { cache: "no-store", signal });
        return { response, data: await response.json() };
      }, 60_000, "โหลดตาราง Testcase");
      if (response.status === 401 && data.authUrl) {
        continueGoogleAuthorization(data.authUrl);
        return;
      }
      if (!response.ok) throw new Error(data.error ?? "โหลด Google Sheet ไม่สำเร็จ");
      if (savedSource?.id) await cacheProjectDefectMetadata(selectedProject.id, data.sheets);
      const alignedSummaryCases = alignRegisterCaseIdentities(importWorkspaceCases, data.cases as TestCase[]);
      const summaryCaseIds = new Map((data.cases as TestCase[]).map((item, index) => [item.id, alignedSummaryCases[index].id]));
      data.cases = alignedSummaryCases;
      data.sheets = (data.sheets as WorkbookSheet[]).map(sheet => ({ ...sheet, testCaseIds: sheet.testCaseIds.map(id => summaryCaseIds.get(id) ?? id), definitionCaseIds: sheet.definitionCaseIds?.map(id => summaryCaseIds.get(id) ?? id) }));
      const detailedCases = new Map<string, TestCase>((data.cases as TestCase[]).map(item => [item.id, item]));
      setCases(current => mergeWorkspaceAndGoogleCases(current, data.cases, currentUser?.name ?? "").cases);
      setSource(current => current ? { ...current, sheets: mergeGoogleSheetsWithSource(current.sheets, data.sheets) } : current);
      const detailSheets = prioritizeReferencedSheets((data.sheets as WorkbookSheet[]).filter(sheet => sheet.name.trim().toLowerCase() !== "testcase"), data.cases as TestCase[]);
      updateProgress("Testcase", { phase: "workbook" });
      setSheetRowLoads({ Testcase: importStates.Testcase, ...Object.fromEntries(detailSheets.map(sheet => [sheet.name, resume && previousImport?.states[sheet.name] === "loaded" ? "loaded" as const : "queued" as const])) });
      const detailNames = resume ? pendingImportSheets(detailSheets.map(sheet => sheet.name), previousImport) : detailSheets.map(sheet => sheet.name);
      detailNames.forEach(name => { importStates[name] = "queued"; });
      const metadataSource: WorkbookSource = savedSource ? { ...savedSource, sheets: mergeGoogleSheetsWithSource(savedSource.sheets, data.sheets) }
        : { fileName: `${selectedProject.name}.xlsx`, buffer: new ArrayBuffer(0), bufferLoaded: false, sheetName: "Testcase", sheetPath: "", columns: {}, sheets: data.sheets };
      publishProgress([...detailedCases.values()], metadataSource, { ...importStates });
      // Each batch also reads register, metadata and formatting. Group more
      // tabs to avoid repeating those requests for every three-sheet group.
      const readBatch = batchRowLoader(detailNames, 6, async names => {
        const query = new URLSearchParams();
        names.forEach(name => query.append("sheet", name));
        const { result, detail } = await withImportTimeout(async signal => {
          const result = await fetch(`/api/projects/${selectedProject.id}/google-sheet?${query}`, { cache: "no-store", signal });
          return { result, detail: await result.json() };
        }, 60_000, `โหลดรายละเอียด ${names.join(", ")}`);
        if (!result.ok) throw new Error(detail.error ?? "โหลดแท็บไม่สำเร็จ");
        return detail as { cases: TestCase[] };
      });
      const rows = await runSheetTextImports(detailNames, readBatch, async (name, detail) => {
        const affected = new Set<string>();
        detail.cases = alignRegisterCaseIdentities([...detailedCases.values()], detail.cases as TestCase[]);
        for (const item of detail.cases) {
          const incoming = (item.results ?? []).filter(result => result.sourceSheetName === name);
          if (incoming.length || item.customFields?.some(field => field.sheetName === name) || item.defects?.some(defect => defect.sourceSheetName === name)) affected.add(item.id);
          const previous = detailedCases.get(item.id) ?? item;
          detailedCases.set(item.id, { ...previous, results: [...(previous.results ?? []).filter(result => result.sourceSheetName !== name), ...incoming], customFields: [...(previous.customFields ?? []).filter(field => field.sheetName !== name), ...(item.customFields ?? []).filter(field => field.sheetName === name)], defects: [...(previous.defects ?? []).filter(defect => defect.sourceSheetName !== name), ...(item.defects ?? []).filter(defect => defect.sourceSheetName === name)], resultFieldDefinitions: [...new Map([...(previous.resultFieldDefinitions ?? []), ...(item.resultFieldDefinitions ?? [])].map(field => [field.key, field])).values()] });
        }
        setCases(current => mergeWorkspaceAndGoogleCases(current, detail.cases, currentUser?.name ?? "").cases);
        completedResultTabs.add(name);
        // Unmapped raw content still needs its workbook snapshot. Never claim
        // that it has been saved just because its API response arrived.
        if (!resume || !affected.size) return "deferred";
        const incomingCases = [...detailedCases.values()].filter(item => affected.has(item.id));
        const safeCases = refreshRegisterCases(importWorkspaceCases, incomingCases, { definitionsReady: false }).cases.filter(item => affected.has(item.id));
        for (const item of safeCases) {
          const saved = await persistTestCaseResult(selectedProject.id, item);
          const sourceCase = detailedCases.get(item.id);
          if (sourceCase) detailedCases.set(item.id, withSavedCaseIdentity(sourceCase, saved));
        }
        return true;
      }, updateProgress, (name, state) => {
        importStates[name] = state;
        setSheetRowLoads(current => ({ ...current, [name]: importStates[name] }));
        publishProgress([...detailedCases.values()], metadataSource, importStates);
      });
      const failedRows = rows.filter(row => row.status === "rejected").length;
      rows.forEach((row, index) => { if (row.status === "rejected") importStates[detailNames[index]] = "error"; });
      if (failedRows) setWorkspaceError(`${failedRows} แท็บโหลดรายละเอียดไม่สำเร็จ — กดลองใหม่ที่แถวนั้น`);
      const workbookBuffer = await workbookPending;
      const imported = importTestCases(workbookBuffer, `${selectedProject.name}.xlsx`);
      const alignedWorkbookCases = alignRegisterCaseIdentities(importWorkspaceCases, imported.cases);
      const workbookCaseIds = new Map(imported.cases.map((item, index) => [item.id, alignedWorkbookCases[index].id]));
      imported.cases = alignedWorkbookCases;
      imported.source.sheets = imported.source.sheets.map(sheet => ({ ...sheet, testCaseIds: sheet.testCaseIds.map(id => workbookCaseIds.get(id) ?? id), definitionCaseIds: sheet.definitionCaseIds?.map(id => workbookCaseIds.get(id) ?? id) }));
      const googleCases = withWorkbookDefinitions(alignRegisterCaseIdentities(importWorkspaceCases, [...detailedCases.values()]), imported.cases);
      sourceDefinitionsReady = true;
      imported.source.documentType = data.documentType;
      imported.source.coverSnapshot = data.coverSnapshot ?? imported.source.coverSnapshot;
      const importedImages = readWorkbookResultImages(imported.source, imported.cases);
      const freeformResults = readWorkbookFreeformResults(imported.source, imported.cases);
      let importedCases: TestCase[] = refreshRegisterCases(importWorkspaceCases, googleCases).cases.map(testCase => ({ ...testCase, results: testCase.results?.map(result => ({ ...result, evidence: [...result.evidence] })) }));
      const importedSheetAssignments = new Map(resolveSheetAssociations(
        (data.sheets as WorkbookSheet[]).filter((sheet) => sheet.name.trim().toLowerCase() !== "testcase"),
        importedCases,
        sheetMappings,
      ).associations.filter(association => association.source === "manual").map((association) => [association.sheet.name.trim().toLocaleLowerCase(), association.testCase.id]));
      for (const [sheetKey, caseId] of unreferencedSnapshotAssignments(importedCases)) {
        if (!importedSheetAssignments.has(sheetKey)) importedSheetAssignments.set(sheetKey, caseId);
      }
      const evidenceTargets = await Promise.all(importedImages.map(async image => ({
        testCaseId: importedSheetAssignments.get(image.sheetName.trim().toLocaleLowerCase()) ?? image.testCaseId,
        sheetName: image.sheetName, key: await importedEvidenceKey(image),
      })));
      const evidenceManifest = [...new Map(evidenceTargets.map(target => [JSON.stringify(target), target])).values()];
      const imageKeys = new Map(importedImages.map((image, index) => [image, evidenceTargets[index].key]));
      importedCases = refreshWorkbookStepEvidence(importedCases, freeformResults, importedImages);
      const changedCaseIds = new Set<string>();
      let attachedImageCount = 0;
      let skippedImageCount = 0;
      let failedImageCount = 0;
      for (const importedResult of freeformResults) {
        if (isProjectDefectSheet(importedResult.sheetName)) continue;
        const assignedCaseId = importedSheetAssignments.get(importedResult.sheetName.trim().toLocaleLowerCase()) ?? importedResult.testCaseId;
        const testCase = importedCases.find((item) => testCaseIdentity(item.id) === testCaseIdentity(assignedCaseId));
        if (!testCase) continue;
        const existing = testCase.results?.find((result) =>
          result.id === importedResult.resultId
          && (!result.sourceSheetName || result.sourceSheetName === importedResult.sheetName));
        if (existing) {
          Object.assign(existing, workbookResultFallback(existing, importedResult));
        } else {
          testCase.results = [...(testCase.results ?? []), {
            id: importedResult.resultId,
            stepId: importedResult.stepId,
            sourceRange: importedResult.sourceRange,
            testerName: testCase.executedBy || '',
            source: 'sheets',
            sourceSheetName: importedResult.sheetName,
            status: testCase.status,
            actualResult: importedResult.actualResult,
            apiResponse: importedResult.apiResponse,
            log: importedResult.log,
            sheetSections: importedResult.sheetSections,
            evidence: [],
            createdAt: new Date().toISOString(),
          }];
        }
        changedCaseIds.add(testCase.id);
      }

      // Persist freeform text first. A failed evidence upload must not make the whole Result disappear.
      if (changedCaseIds.size) {
        const textOnlySavedCases = new Map((await completeProjectDetailWrites(importedCases
          .filter((testCase) => changedCaseIds.has(testCase.id))
          .map((testCase) => persistTestCaseResult(selectedProject.id, testCase))))
          .map((testCase) => [testCase.id, testCase]));
        importedCases.forEach((testCase, index) => {
          importedCases[index] = textOnlySavedCases.get(testCase.id) ?? testCase;
        });
      }
      setCases([...importedCases]);
      const mergedSheets = mergeGoogleSheetsWithSource(imported.source.sheets, data.sheets);
      // Keep the last saved source/checkpoint visible until the replacement
      // source metadata has been registered successfully.

      completedResultTabs.forEach(name => updateProgress(name, { phase: "saving" }));
      if (resume && previousImport && savedSource?.id && !previousImport.refreshRequired) {
        // Continue the existing snapshot without uploading a duplicate workbook.
        await completeProjectDetailWrites(importedCases.map(item => persistTestCaseResult(selectedProject.id, item)));
        importSource = { ...imported.source, sheets: mergedSheets, id: savedSource.id, sourceOrigin: savedSource.sourceOrigin, workbookStorage: savedSource.workbookStorage, sheetImport: previousImport };
      } else {
        const savedWorkbook = await persistImportedWorkbook(selectedProject.id, importedCases, {
          ...imported.source, sheets: mergedSheets,
          sheetImport: { ...checkpointSheetImport(undefined, selectedProject.googleSheetId, importStates, new Date().toISOString(), false), sourceRevision, registerBaseline: previousImport?.registerBaseline, evidenceManifest },
        }, true,"google-sheets");
        importSource = { ...imported.source, sheets: mergedSheets, id: savedWorkbook.source!.id, workbookStorage: savedWorkbook.source!.workbookStorage, sourceOrigin: savedWorkbook.source!.sourceOrigin, sheetImport: savedWorkbook.source!.sheetImport };
      }
      setSource(importSource);
      setHasDetailedGoogleData(true);
      setHasGoogleWorkbook(true);
      clearProjectWorkbook(selectedProject.id);
      importStates.Testcase = "loaded";
      importSource.sheetImport = await persistSheetImportState(selectedProject.id, importSource.id!, selectedProject.googleSheetId, importStates, false, false, evidenceManifest);
      setSheetRowLoads(importSource.sheetImport.states);
      publishProgress(importedCases, importSource, importSource.sheetImport.states);

      let authorizationPending = false;
      let evidenceUploadError = "";
      const uploadEvidence = evidenceUploadBatch();
      const sharedFiles = sharedEvidenceFiles<TestEvidence>();
      await runSheetEvidenceImports(detailSheets.filter(sheet => importStates[sheet.name] === "loaded" || completedResultTabs.has(sheet.name)).map(sheet => sheet.name), importedImages, image => image.sheetName, async image => {
        if (authorizationPending) return false;
        const assignedCaseId = importedSheetAssignments.get(image.sheetName.trim().toLocaleLowerCase()) ?? image.testCaseId;
        const testCase = importedCases.find((item) => testCaseIdentity(item.id) === testCaseIdentity(assignedCaseId));
        if (!testCase || !image.mimeType.startsWith("image/")) {
          skippedImageCount += 1;
          incompleteEvidenceTabs.add(image.sheetName);
          return false;
        }
        const importKey = imageKeys.get(image)!;
        let result = testCase.results?.find((item) =>
          item.id.trim() === image.resultId.trim()
          && (!item.sourceSheetName || item.sourceSheetName === image.sheetName));
        // Older imports used generated Result IDs and Google Drive prepended a
        // timestamp to the evidence name. Recover the owning Result from the
        // stable sheet/row/column portion instead of uploading a duplicate.
        result ??= testCase.results?.find((item) => item.evidence.some((evidence) => evidence.name.includes(importKey)));
        if (!result && image.resultId.startsWith("SHEET-IMPORT-")) {
          result = {
            id: image.resultId,
            testerName: testCase.executedBy || '',
            source: 'sheets',
            sourceSheetName: image.sheetName,
            status: testCase.status,
            actualResult: `นำเข้าจาก Google Sheets · ${image.sheetName}`,
            apiResponse: "",
            log: "",
            evidence: [],
            createdAt: new Date().toISOString(),
          };
          testCase.results = [...(testCase.results ?? []), result];
        }
        if (!result) {
          skippedImageCount += 1;
          incompleteEvidenceTabs.add(image.sheetName);
          return false;
        }
        if (!result.sourceSheetName) {
          result.sourceSheetName = image.sheetName;
          changedCaseIds.add(testCase.id);
        }
        const targetResult = result;
        return uploadEvidence(JSON.stringify([testCase.id, targetResult.id, importKey]), async () => {
          if (targetResult.evidence.some((evidence) => evidence.name.includes(importKey))) return true;
          const evidence = await sharedFiles(JSON.stringify([image.sheetName, importKey]), async () => {
          const saved = importedCases.flatMap(item => (item.results ?? []).filter(result => result.source === 'sheets' && !result.editedLocally && result.sourceSheetName === image.sheetName).flatMap(result => result.evidence)).find(evidence => evidence.name.includes(importKey));
          if (saved) return saved;
          const originalFile = new File([new Uint8Array(image.bytes)], `${importKey}-${image.name}`, { type: image.mimeType });
          try {
            const prepared = await compressEvidenceImage(originalFile);
            const form = new FormData();
            form.set("file", prepared.file);
            form.set("testCaseId", testCase.id);
            form.set("sourceRow", String(testCase.sourceRow));
            const uploadResponse = await fetch(`/api/projects/${selectedProject.id}/evidence`, { method: "POST", body: form });
            const uploadData = await uploadResponse.json();
            if (uploadResponse.status === 401 && uploadData.authUrl) {
              incompleteEvidenceTabs.add(image.sheetName);
              authorizationPending = true;
              continueGoogleAuthorization(uploadData.authUrl);
              return null;
            }
            if (uploadData.code === "PROJECT_OWNER_GOOGLE_CONNECTION_REQUIRED" || uploadData.code === "PROJECT_OWNER_REQUIRED") {
              authorizationPending = true;
              incompleteEvidenceTabs.add(image.sheetName);
              evidenceUploadError = uploadData.error ?? "ผู้สร้างโปรเจคต้องเชื่อม Google Drive ก่อนอัปโหลดรูป";
              setWorkspaceError(evidenceUploadError);
              return null;
            }
            if (!uploadResponse.ok) throw new Error(uploadData.error ?? `นำเข้ารูปของ ${testCase.id} ไม่สำเร็จ`);
            return uploadData.evidence as TestEvidence;
          } catch (reason) {
            evidenceUploadError ||= `${image.sheetName}: ${reason instanceof Error ? reason.message : "อัปโหลดรูปไม่สำเร็จ"}`;
            setWorkspaceError(evidenceUploadError);
            failedImageCount += 1;
            incompleteEvidenceTabs.add(image.sheetName);
            return null;
          }
          });
          if (!evidence) { incompleteEvidenceTabs.add(image.sheetName); return false; }
          targetResult.evidence.push({ ...evidence });
          changedCaseIds.add(testCase.id);
          attachedImageCount += 1;
          return true;
        });
      }, async (name, complete) => {
        if (!complete) incompleteEvidenceTabs.add(name);
        const tabCases = importedCases.filter(item => changedCaseIds.has(item.id) && item.results?.some(result => result.sourceSheetName === name));
        await completeProjectDetailWrites(tabCases.map(item => persistTestCaseResult(selectedProject.id, item)));
        importStates[name] = complete ? "loaded" : "error";
        importSource!.sheetImport = await persistSheetImportState(selectedProject.id, importSource!.id!, selectedProject.googleSheetId, { [name]: importStates[name] }, false);
        setSource({ ...importSource! });
        setSheetRowLoads(current => ({ ...current, [name]: importStates[name] }));
        publishProgress(importedCases, importSource, { ...importStates });
      }, updateProgress, (name, state) => {
        importStates[name] = state;
        if (state === "error") incompleteEvidenceTabs.add(name);
        setSheetRowLoads(current => ({ ...current, [name]: state }));
        publishProgress(importedCases, importSource, importStates);
      });
      const savedCases = new Map((await completeProjectDetailWrites(importedCases
        .filter((testCase) => changedCaseIds.has(testCase.id))
        .map((testCase) => persistTestCaseResult(selectedProject.id, testCase))))
        .map((testCase) => [testCase.id, testCase]));
      const nextCases = importedCases.map((testCase) => savedCases.get(testCase.id) ?? testCase);
      setCases(nextCases);
      completedResultTabs.forEach(name => { importStates[name] = incompleteEvidenceTabs.has(name) ? "error" : "loaded"; });
      for (const item of nextCases) {
        if (!selectDetailSheets(mergedSheets, { testcaseId: item.id }).length) importStates[`testcase:${item.id}`] = "loaded";
      }
      const latestRevision = await readSourceRevision(selectedProject.id);
      const dataComplete = detailSheets.every(sheet => importStates[sheet.name] === "loaded")
        && approvalEvidenceReadiness({ ...importSource.sheetImport!, complete: true, refreshRequired: false, states: importStates, evidenceManifest }, nextCases, detailSheets.map(sheet => sheet.name)).ready;
      const revisionStatus = sheetImportRevisionStatus(sourceRevision, latestRevision, dataComplete);
      importSource.sheetImport = await persistSheetImportState(selectedProject.id, importSource.id!, selectedProject.googleSheetId, importStates, revisionStatus.complete, revisionStatus.refreshRequired, evidenceManifest, sourceRevision, registerBaseline(googleCases));
      setSource({ ...importSource });
      setSheetRowLoads(importSource.sheetImport.states);
      workspaceNavigationCache.set(selectedProject.id, { cases: nextCases, source: { ...importSource }, sheetMappings, hasLoadedSheetMappings: true, hasUnsyncedChanges: false, hasDetailedGoogleData: true, hasGoogleWorkbook: true, sheetRowLoads: importSource.sheetImport.states });

      locallyCreatedCaseIds.current.clear();
      setHasUnsyncedChanges(false);
      const imageCount = imported.source.sheets.reduce((total, sheet) => total + sheet.imageCount, 0);
      const skippedMessage = skippedImageCount ? ` · ข้าม ${skippedImageCount} รูปที่จับคู่ Result ไม่ได้` : "";
      const failedMessage = failedImageCount ? ` · รูปไม่สำเร็จ ${failedImageCount}` : "";
      if (revisionStatus.refreshRequired) {
        setWorkspaceError("Sheets เปลี่ยนระหว่างนำเข้า กรุณากดอัปเดตอีกครั้งเพื่อรับข้อมูลล่าสุด");
        return;
      }
      if (evidenceUploadError) {
        setWorkspaceError(evidenceUploadError);
        return;
      }
      flash(`โหลด ${nextCases.length} Testcases · Freeform ${freeformResults.length} Result · แนบรูปใหม่ ${attachedImageCount}/${imageCount} รูป${skippedMessage}${failedMessage}`);
    } catch (reason) {
      for (const [name, state] of Object.entries(importStates)) {
        if (state === "loading" || state === "queued") importStates[name] = "error";
      }
      setSheetRowLoads({ ...importStates });
      const cached = workspaceNavigationCache.get(selectedProject.id);
      if (cached) workspaceNavigationCache.set(selectedProject.id, { ...cached, sheetRowLoads: { ...importStates } });
      const message = reason instanceof Error ? reason.message : "โหลด Google Sheet ไม่สำเร็จ";
      setWorkspaceError(message);
      flash(message);
    } finally {
      activeProjectImports.delete(selectedProject.id);
      setPullingGoogle(false);
      window.dispatchEvent(new CustomEvent("qa-project-import-complete", { detail: selectedProject.id }));
    }
  }

  const startAutomaticImport = useEffectEvent(async (controller: AbortController) => {
    if (!selectedProject?.googleSheetId || !canEditProject) return;
    const projectId = selectedProject.id;
    setCheckingSheetsProject(projectId);
    setSheetCheckErrorProject(null);
    try {
      const revision = await readSourceRevision(projectId, controller.signal);
      if (controller.signal.aborted) return;
      const mode = automaticSheetImportMode(source?.sheetImport, revision);
      if (mode) {
        setCheckingSheetsProject(null);
        await pullFromGoogle(mode === "resume", revision);
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setSheetCheckErrorProject(projectId);
        setWorkspaceError(reason instanceof Error ? reason.message : "ตรวจข้อมูลล่าสุดจาก Sheets ไม่สำเร็จ");
      }
    } finally {
      setCheckingSheetsProject(current => current === projectId ? null : current);
    }
  });
  useEffect(() => {
    if (!selectedProjectId || loadingWorkspace || loadingSheetPreview || !hasLoadedSheetMappings
      || activeProjectImports.has(selectedProjectId) || autoImportAttempted.current.has(selectedProjectId)) return;
    const attempted = autoImportAttempted.current;
    attempted.add(selectedProjectId);
    const controller = new AbortController();
    void startAutomaticImport(controller);
    return () => {
      controller.abort();
      attempted.delete(selectedProjectId);
    };
  }, [selectedProjectId, loadingWorkspace, loadingSheetPreview, hasLoadedSheetMappings]);

  const receiveCompletedImport = useEffectEvent(() => {
    if (!selectedProjectId) return;
    const completed = workspaceNavigationCache.get(selectedProjectId);
    setPullingGoogle(activeProjectImports.has(selectedProjectId));
    if (!completed) return;
    setCases(current => hasUnsyncedChanges ? mergeWorkspaceAndGoogleCases(current, completed.cases, currentUser?.name ?? "").cases : completed.cases);
    setSource(completed.source);
    setSheetRowLoads(completed.sheetRowLoads);
    setSheetLoadProgress(completed.sheetLoadProgress ?? {});
    setHasDetailedGoogleData(completed.hasDetailedGoogleData);
    setHasGoogleWorkbook(completed.hasGoogleWorkbook);

  });
  useEffect(() => {
    const listener = (event: Event) => { if ((event as CustomEvent<string>).detail === selectedProjectId) receiveCompletedImport(); };
    const stageListener = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== selectedProjectId || !selectedProjectId) return;
      setSheetLoadProgress(workspaceNavigationCache.get(selectedProjectId)?.sheetLoadProgress ?? {});
    };
    window.addEventListener("qa-project-import-complete", listener);
    window.addEventListener("qa-project-import-progress", listener);
    window.addEventListener("qa-project-import-stage", stageListener);
    return () => {
      window.removeEventListener("qa-project-import-complete", listener);
      window.removeEventListener("qa-project-import-progress", listener);
      window.removeEventListener("qa-project-import-stage", stageListener);
    };
  }, [selectedProjectId]);

  async function retrySheetRow(name: string) {
    if (!selectedProject) return;
    if (activeProjectImports.has(selectedProject.id)) return flash("แท็บนี้กำลังถูกนำเข้าอยู่ กรุณารอให้เสร็จก่อนลองใหม่");
    setRowLoadProjectId(selectedProject.id);
    setSheetRowLoads(current => ({ ...current, [name]: "loading" }));
    setSheetLoadProgress(current => ({ ...current, [name]: { phase: "details" } }));
    try {
      const sourceRevision = await readSourceRevision(selectedProject.id);
      const response = await fetch(`/api/projects/${selectedProject.id}/google-sheet${name === "Testcase" ? "?summary=1" : `?sheet=${encodeURIComponent(name)}`}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "โหลดแท็บไม่สำเร็จ");
      setCases(current => mergeWorkspaceAndGoogleCases(current, data.cases, currentUser?.name ?? "").cases);
      if (name !== "Testcase") {
        setSheetLoadProgress(current => ({ ...current, [name]: { phase: "workbook" } }));
        const workbookSource = await revisionBoundSource(sourceRevision, source,
          revision => getGoogleWorkbook(false, revision), bytes => importTestCases(bytes, `${selectedProject.name}.xlsx`).source,
          () => readSourceRevision(selectedProject.id));
        let loadedSource = { ...workbookSource, sheets: mergeGoogleSheetsWithSource(workbookSource.sheets, data.sheets ?? []) };
        const sheet = loadedSource.sheets.find(sheet => sheet.name === name);
        if (!sheet) throw new Error(`ไม่พบรูปแบบรายละเอียดของ ${name}`);
        readWorkbookSheet(loadedSource, sheet);
        if (selectedProject.canEdit) {
          setSheetLoadProgress(current => ({ ...current, [name]: { phase: "saving" } }));
          const nextCases = mergeWorkspaceAndGoogleCases(cases, data.cases, currentUser?.name ?? "").cases;
          await Promise.all(nextCases.filter(item => item.results?.some(result => result.sourceSheetName === name) || item.defects?.some(defect => defect.sourceSheetName === name)).map(item => persistTestCaseResult(selectedProject.id, item)));
          const previous = readSheetImportState(source?.sheetImport, selectedProject.googleSheetId);
          if (!loadedSource.id) {
            const saved = await persistImportedWorkbook(selectedProject.id, nextCases, {
              ...loadedSource, documentType: data.documentType, sheetImport: revisionBoundCheckpoint(previous, selectedProject.googleSheetId, { [name]: "loaded" }, new Date().toISOString(), sourceRevision),
            }, false,"google-sheets");
            loadedSource = { ...loadedSource, id: saved.source!.id, workbookStorage: saved.source!.workbookStorage, sourceOrigin: saved.source!.sourceOrigin, sheetImport: saved.source!.sheetImport };
            clearProjectWorkbook(selectedProject.id);
          } else {
            loadedSource = { ...loadedSource, sheetImport: await persistSheetImportState(selectedProject.id, loadedSource.id, selectedProject.googleSheetId, { [name]: "loaded" }, previous?.complete ?? false) };
          }
        }
        setSource(loadedSource);
        setHasGoogleWorkbook(true);
      }
      setSheetRowLoads(current => ({ ...current, [name]: "loaded" }));
    } catch (reason) {
      setSheetRowLoads(current => ({ ...current, [name]: "error" }));
      flash(reason instanceof Error ? reason.message : "โหลดแท็บไม่สำเร็จ");
    }
  }

  async function applyGoogleSync(inputCases: TestCase[]) {
    if (!selectedProject) throw new Error("กรุณาเลือก Project");
    const timestampedCases = inputCases.map(withPassedTimestamp);
    const syncCases = await Promise.all(timestampedCases.map((testCase) => persistTestCaseResult(selectedProject.id, testCase)));
    setCases(current => current.map(item => syncCases.find(saved => saved.id === item.id) ?? item));
    try {
      const response = await fetch(`/api/projects/${selectedProject.id}/google-sheet`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cases: syncCases }) });
      const data = await response.json();
      if (response.status === 401 && data.authUrl) {
        continueGoogleAuthorization(data.authUrl);
        return;
      }
      if (!response.ok) throw new Error(data.error ?? "ซิงค์ Google Sheet ไม่สำเร็จ");
      if (source?.id && source.sheetImport) {
        const sheetImport = await persistSheetImportState(selectedProject.id, source.id, selectedProject.googleSheetId, {}, false, true);
        setSource(current => current ? { ...current, sheetImport, bufferLoaded: false } : current);
      }
      clearProjectWorkbook(selectedProject.id);
      setSheetRowLoads({});
      setSource(current => current ? { ...current, bufferLoaded: false } : current);
      setHasGoogleWorkbook(false);
      locallyCreatedCaseIds.current.clear();
      setHasUnsyncedChanges(false);
      flash(`ซิงค์แล้ว ${data.updatedCells} cells · ${data.resultSheets ?? 0} result sheets · ${data.defects ?? 0} defects`);
    } finally {
      setSyncConflictState(null);
    }
  }

  async function syncToGoogle() {
    if (!selectedProject?.googleSheetId) return setShowGoogleSheetDialog(true);
    if (source?.documentType === "xlsx") return flash("ไฟล์นี้เป็น Excel บน Drive กรุณาดาวน์โหลดผล หรือแปลงเป็น Google Sheets ก่อนซิงค์กลับ");
    if (!canEditProject) return flash("Project นี้เปิดให้คุณดูอย่างเดียว");
    setSyncingGoogle(true);
    try {
      const response = await fetch(`/api/projects/${selectedProject.id}/google-sheet`, { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401 && data.authUrl) return continueGoogleAuthorization(data.authUrl);
      if (!response.ok) throw new Error(data.error ?? "ตรวจสอบข้อมูล Google Sheets ไม่สำเร็จ");
      if (data.documentType === "xlsx") throw new Error("การซิงค์กลับรองรับเฉพาะ Google Sheets ไฟล์ Excel สามารถบันทึกผลในเว็บและดาวน์โหลดได้");
      const googleCases = data.cases as TestCase[];
      const baseline = data.baseline as CanonicalProjectSnapshot | undefined;
      const conflicts = baseline && Object.keys(baseline.cases).length
        ? detectThreeWayCaseConflicts(cases, googleCases, baseline)
        : detectBootstrapCaseConflicts(cases, googleCases);
      if (conflicts.length) {
        setSyncConflictState({ operation: "push", conflicts, googleCases });
        return;
      }
      await applyGoogleSync(mergeCaseChoices(cases, googleCases, {}));
    } catch (reason) {
      flash(reason instanceof Error ? reason.message : "ซิงค์ Google Sheet ไม่สำเร็จ");
    } finally {
      setSyncingGoogle(false);
    }
  }

  async function confirmSyncConflicts(choices: Record<string, CaseChoice>) {
    if (!syncConflictState) return;
    setSyncingGoogle(true);
    try {
      await applyGoogleSync(mergeCaseChoices(cases, syncConflictState.googleCases, choices));
    } finally {
      setSyncingGoogle(false);
    }
  }

  async function removeSelectedProject() {
    if (!selectedProject || !window.confirm(`ลบ Project “${selectedProject.name}” พร้อมข้อมูล ผลทดสอบ รูปหลักฐาน และ Approval ทั้งหมดหรือไม่? Google Sheets จะยังคงอยู่ การดำเนินการนี้ย้อนกลับไม่ได้`)) return;
    const project = selectedProject;
    const result = await deleteProject(project.id);
    if ("error" in result) return flash(result.error ?? "ลบ Project ไม่สำเร็จ");
    setProjects((current) => current.filter((item) => item.id !== project.id));
    setCases([]);
    setSource(null);
    if(result.warnings.length) {router.push(`/groups/${groupId}/years?googleCleanupWarning=1`);return;}
    flash(`ลบ Project ${project.name} แล้ว`);
    router.push(`/groups/${groupId}/projects`);
  }

  async function downloadResult() {
    if (!source) {
      setShowUpload(true);
      return;
    }
    setExporting(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 40));
      const exportSource = await ensureWorkbookLoaded();
      const bytes = exportTestCases(exportSource, cases);
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = exportSource.fileName.replace(/\.xlsx$/i, "_result.xlsx");
      anchor.click();
      URL.revokeObjectURL(url);
      flash("สร้างไฟล์ผลการทดสอบแล้ว");
    } catch (reason) {
      flash(reason instanceof Error ? reason.message : "สร้างไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setExporting(false);
    }
  }

  if (!configured) return <SetupView />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><ClipboardCheck size={23} /></div><div><strong>QA Workspace</strong><span>Test execution</span></div></div>
        {!selectedProject ? <>
          <nav className="main-nav" aria-label="เมนูระดับกลุ่ม">
            <Link href={scopedYear ? `/groups?year=${scopedYear}` : "/groups"}><Users size={19} />Groups</Link>
            <Link href={scopedYear ? `/groups/${groupId}/years/${scopedYear}/sprints` : `/groups/${groupId}/years`}>Sprints</Link>
            {sprintBase && <Link href={sprintBase}><LayoutDashboard size={19} />Sprint Dashboard</Link>}
            <Link className="active" href={projectsHref}><FolderKanban size={19} />Projects<span className="nav-count">{projects.length}</span></Link>
          </nav>
          <div className="sidebar-footer"><button><Settings size={18} />ตั้งค่ากลุ่ม</button></div>
        </> : <>
          <div className="sidebar-section project-context">
            <Link className="back-to-projects" href={projectsHref}><ChevronRight size={15} />กลับไป Projects</Link>
            <label className="project-switcher"><span>PROJECT</span><select value={selectedProject.id} onChange={(event) => router.push(`/groups/${groupId}/projects/${event.target.value}/overview`)}>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
          </div>
          <nav className="main-nav project-nav" aria-label="Project Workspace">
            <p className="nav-heading">PROJECT WORKSPACE</p>
            <Link className={activePage === "overview" ? "active" : ""} href={`/groups/${groupId}/projects/${selectedProject.id}/overview`}><LayoutDashboard size={19} />ภาพรวม</Link>
            <Link className={activePage === "test-cases" ? "active" : ""} href={`/groups/${groupId}/projects/${selectedProject.id}/test-cases`}><ClipboardCheck size={19} />Test cases<span className="nav-count">{loadingWorkspace ? "…" : cases.length}</span></Link>
            <Link className={activePage === "defects" ? "active" : ""} href={`/groups/${groupId}/projects/${selectedProject.id}/defects`}><CircleAlert size={19} />Defects<span className="nav-count alert">{allDefects.length}</span></Link>
            <Link className={activePage === "files" ? "active" : ""} href={`/groups/${groupId}/projects/${selectedProject.id}/files`}><FileArchive size={19} />เอกสาร/ไฟล์</Link>
            <Link className={activePage === "settings" ? "active" : ""} href={`/groups/${groupId}/projects/${selectedProject.id}/settings`}><Settings size={19} />ตั้งค่า</Link>
          </nav>
        </>}
        {currentUser && <div className="signed-in-user"><span className="avatar compact">{currentUser.name.slice(0, 2).toUpperCase()}</span><div><strong>{currentUser.name}</strong><span>{currentUser.email}</span></div><form action={signOut}><button type="submit" aria-label="ออกจากระบบ">ออก</button></form></div>}
      </aside>
      {mobileNav && <button className="mobile-overlay" aria-label="ปิดเมนู" onClick={() => setMobileNav(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="เปิดเมนู"><Menu size={21} /></button>
          {selectedProject ? <ProjectBreadcrumb year={scopedYear} groupId={groupId} sprintHref={sprintBase} sprintName={planningSprint?.name ?? selectedProject.sprintNo} projectsHref={projectsHref} projectName={selectedProject.name} /> : <div className="breadcrumb"><Link href="/groups">เลือกปี</Link>{scopedYear && <><ChevronRight size={15} /><Link href={`/groups?year=${scopedYear}`}>ปี {scopedYear} · Groups</Link><ChevronRight size={15}/><Link href={`/groups/${groupId}/years/${scopedYear}/sprints`}>Sprints</Link></>}{sprintBase && <><ChevronRight size={15} /><Link href={sprintBase}>{planningSprint?.name}</Link></>}<ChevronRight size={15} /><Link href={projectsHref}>Projects</Link></div>}
          <GlobalProjectSearch />
          <div className="topbar-actions">{selectedProject && currentEnvironment && <span className="environment-pill"><span />{currentEnvironment}</span>}</div>
        </header>

        <div className="page-content" id="dashboard">
          {!selectedProject ? sprintProjectData ? <><SprintProjectList data={sprintProjectData} groupId={groupId} year={planningSprint?.year ?? 0}/>{canCreateProject && <button className="primary-button" onClick={()=>setShowProjectDialog(true)}>เพิ่ม Project</button>}</> : <ProjectsHome projects={projects} error={projectsError} canCreate={canCreateProject} onUpdated={(project) => { setProjects((current) => current.map((p) => p.id === project.id ? project : p).filter((p) => !planningSprint || p.sprintId === planningSprint.id)); router.refresh(); }} onAdd={() => setShowProjectDialog(true)} projectHref={(project) => `/groups/${groupId}/projects/${project.id}/overview`} /> : <>
          <section className="page-heading"><div><div className="title-line"><h1>{sheetName ? decodeURIComponent(sheetName) : activePage === "overview" ? selectedProject.name : ({ "test-cases": "Test cases", defects: "Defects", files: "เอกสาร/ไฟล์", settings: "ตั้งค่า Project" } as Record<string, string>)[activePage]}</h1>{selectedProject.sprintNo && <span className="sprint-pill">{selectedProject.sprintNo}</span>}{!canEditProject && <span className="read-only-badge">ดูอย่างเดียว</span>}{hasUnsyncedChanges && <span className="unsynced-pill">ยังไม่ Sync</span>}</div><p>{sheetName ? `รายละเอียด tab จาก Google Sheets · ${selectedProject.name}` : activePage === "overview" ? (selectedProject.description || "ภาพรวมการทดสอบของ Project") : selectedProject.name}</p></div><div className="heading-actions google-actions">
            {!testCaseId && !sheetName && activePage === "test-cases" && !loadingWorkspace && !showProjectImportProgress && (selectedProject.googleSheetId ? canEditProject : canManageProject) && <button className="secondary-button" onClick={() => void pullFromGoogle(importAction.resume)} disabled={pullingGoogle || checkingSheets}>{pullingGoogle ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}{selectedProject.googleSheetId ? importAction.label : "เชื่อม Google Sheet"}</button>}
          </div></section>
          {source?.documentType === "xlsx" && <div className="source-banner" role="note"><FileSpreadsheet size={18} /><div><strong>Excel บน Google Drive</strong><span>บันทึกผลในเว็บและดาวน์โหลดได้ · ซิงค์กลับได้เฉพาะ Google Sheets · ระบบไม่แก้ไขไฟล์ Excel ต้นฉบับ</span></div></div>}

          {loadingWorkspace && <div className="source-banner"><LoaderCircle className="spin" size={18} /><div><strong>กำลังโหลดข้อมูลจาก Supabase</strong><span>กำลังโหลด Testcase และไฟล์ต้นฉบับของ Project</span></div></div>}
          {loadingWorkspace && (testCaseId || sheetName) && <CaseDrawerSkeleton />}
          {!canEditProject && <section className="read-only-notice"><ShieldCheck size={18} /><div><strong>โหมดดูอย่างเดียว</strong><span>คุณดู Test cases, Results, Defects, รูป และ Google Sheet details ได้ แต่ยังแก้ไขหรือซิงค์ข้อมูลไม่ได้</span></div></section>}
          {workspaceError && <section className="project-error"><CircleAlert size={20} /><div><strong>{sheetCheckFailed ? "ตรวจข้อมูลล่าสุดจาก Sheets ไม่สำเร็จ" : "โหลดข้อมูล Project ไม่สำเร็จ"}</strong><span>{workspaceError}</span>{/สิทธิ์ Google|googleAuth/i.test(workspaceError) && <button type="button" className="secondary-button" onClick={() => continueGoogleAuthorization("/api/google/auth/start", true)}>ขอสิทธิ์ Google ใหม่</button>}</div></section>}
          {checkingSheets && <section className="project-evidence-progress" aria-label="ตรวจข้อมูลล่าสุดจาก Sheets"><div className="evidence-progress-body"><p role="status"><LoaderCircle className="spin" size={18} /> กำลังตรวจข้อมูลล่าสุดจาก Sheets…</p><div className="evidence-progress-track evidence-progress-indeterminate" role="progressbar" aria-label="กำลังตรวจข้อมูลล่าสุด"><div style={{ width: "0%" }} /></div></div></section>}
          {!checkingSheets && showProjectImportProgress && <ProjectEvidenceProgress
            key={`evidence-import:${selectedProject.id}`}
            projectName={selectedProject.name}
            names={source?.sheets.map(sheet => sheet.name) ?? Object.keys(activeSheetRowLoads)}
            states={pullingGoogle ? activeSheetRowLoads : source?.sheetImport?.states ?? activeSheetRowLoads}
            progress={rowLoadProjectId === selectedProjectId ? sheetLoadProgress : {}}
            active={pullingGoogle}
            ready={evidenceReadiness.ready && !sheetCheckFailed && !workspaceError}
            expectedImages={source?.sheetImport?.evidenceManifest ? evidenceReadiness.expected : undefined}
            persistedImages={evidenceReadiness.persisted}
            missingEvidence={evidenceReadiness.missing}
            refreshRequired={source?.sheetImport?.refreshRequired}
            errorMessage={workspaceError}
            actionLabel={importAction.label}
            actionDescription={importAction.description}
            canRetry={canEditProject && !testCaseId && !sheetName}
            onRetry={() => void pullFromGoogle(importAction.resume)}
          />}

          {!loadingWorkspace && testCaseId && activeSelectedCase && (<CaseDrawer
            key={`${activeSelectedCase.id}:${(activeSelectedCase.results ?? []).map((result) => `${result.id}-${result.evidence.length}`).join(",")}:${source?.sheets.length ?? 0}`}
            value={activeSelectedCase}
            caseDisplayNames={Object.fromEntries(workspaceCases.map(item=>[item.id,displayTestCaseId(item)]))}
            projectId={selectedProject.id}
            source={source}
            associatedSheets={associatedSheetsByCase.get(testCaseIdentity(activeSelectedCase.id))}
            loadingSheetDetails={loadingSheetPreview}
            currentUserName={currentUser?.name ?? ""}
            readOnly={!canEditProject || pullingGoogle || checkingSheets || loadingSheetPreview}
            pageMode
            onClose={returnToTestCases}
            onSave={saveCase}
            onSaveResult={saveResult}
            onEnsureWorkbook={ensureWorkbookLoaded}
          />)}

          {!loadingWorkspace && !testCaseId && sheetName && activeSheet && <section className="panel sheet-mapping-detail-bar">
            <div><span className="eyebrow">GOOGLE SHEET MAPPING</span><strong>{activeSheet.name}</strong><small>{activeSheetAssociation ? `กำลังแสดงเป็นผลของ ${activeSheetAssociation.testCase.id}` : "แท็บนี้ยังไม่ได้ผูกกับ Test Case — กรุณากด Map"}</small></div>
            <SheetMappingControl key={`${activeSheet.path}:${activeSheetAssociation?.mapping?.testcaseKey ?? activeInvalidMapping?.testcaseKey ?? activeSheetCase?.id ?? "unmapped"}`} projectId={selectedProject.id} sheet={activeSheet} cases={cases} existingMapping={activeSheetAssociation?.mapping ?? activeInvalidMapping} suggestedTestcaseKey={activeSheetAssociation?.source === "automatic" ? activeSheetCase?.id : undefined} canEdit={selectedProject.canEdit} onChanged={(mapping) => updateSheetMapping(activeSheet, mapping)} />
          </section>}

          {!loadingWorkspace && !testCaseId && sheetName && displayedSheetCase && <CaseDrawer
            key={`sheet-${activeSheet?.name}-${displayedSheetCase.id}:${(displayedSheetCase.results ?? []).map((result) => `${result.id}-${result.evidence.length}`).join(",")}`}
            value={displayedSheetCase}
            caseDisplayNames={Object.fromEntries(workspaceCases.map(item=>[item.id,displayTestCaseId(item)]))}
            projectId={selectedProject.id}
            source={source}
            associatedSheets={activeSheet ? [activeSheet] : []}
            currentUserName={currentUser?.name ?? ""}
            readOnly={!canEditProject || pullingGoogle || checkingSheets || loadingSheetPreview || !activeSheetAssociation}
            pageMode
            loadingSheetDetails={loadingSheetPreview}
            focusedSheetName={activeSheet?.name ?? ""}
            onClose={returnToTestCases}
            onSave={saveCase}
            onSaveResult={saveResult}
            onEnsureWorkbook={ensureWorkbookLoaded}
          />}

          {!testCaseId && activePage === "overview" && <><section className="stats-grid">
            <StatCard icon={<ClipboardCheck size={21} />} label="Test cases ทั้งหมด" value={testCaseTotal} detail="ในรอบทดสอบนี้" tone="blue" />
            <StatCard icon={<CircleAlert size={21} />} label="Defects รวม" value={defectSummary.total} detail={`ปิดแล้ว ${defectSummary.closed} · ยังไม่ปิด ${defectSummary.open}`} tone="blue" />
            <StatCard icon={<CheckCircle2 size={21} />} label="ผ่าน" value={counts.Pass} detail={`${testCaseTotal ? Math.round(counts.Pass / testCaseTotal * 100) : 0}% ของทั้งหมด`} tone="green" />
            <StatCard icon={<CircleAlert size={21} />} label="ไม่ผ่าน" value={counts.Failed} detail="ต้องตรวจสอบ" tone="red" />
            <StatCard icon={<Clock3 size={21} />} label="รอดำเนินการ" value={counts["Not Start"] + counts["In Progress"]} detail="ยังไม่สรุปผล" tone="amber" />
          </section>

          {source && <WorkbookSummary cases={cases} source={source} />}
          <section className="overview-grid">
            <article className="panel progress-panel"><div className="panel-heading"><div><h2>ความคืบหน้า</h2><p>สถานะรวมของ Testcase</p></div><button className="icon-button"><MoreHorizontal size={19} /></button></div><div className="progress-content"><div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><div><strong>{progress}%</strong><span>ดำเนินการแล้ว</span></div></div><div className="progress-legend">{TEST_STATUSES.filter((status) => status !== "In Progress").map((status) => <button key={status} onClick={() => setStatusFilter(status)}><span className={`legend-dot ${statusMeta[status].className}`} /><span>{statusMeta[status].label}</span><strong>{counts[status]}</strong></button>)}</div></div></article>
            <article className="panel activity-panel"><div className="panel-heading"><div><h2>กิจกรรมล่าสุด</h2><p>การเปลี่ยนแปลงจากข้อมูลจริง</p></div></div><div className="empty-state compact-empty"><Clock3 size={24} /><strong>ยังไม่มีกิจกรรม</strong><span>กิจกรรมจะแสดงเมื่อเชื่อมการบันทึกผลกับ Supabase</span></div></article>
          </section></>}
          {!testCaseId && activePage === "overview" && <ProjectApprovalPanel evidenceProgressVisible={showProjectImportProgress} key={selectedProject.id} project={selectedProject} cases={cases} counts={counts} testingFinished={testingFinished} loading={loadingWorkspace} currentEnvironment={currentEnvironment} currentUser={currentUser} canSubmit={canEditProject} onConnectSheet={() => setShowGoogleSheetDialog(true)} flash={flash} evidenceReady={evidenceReadiness.ready && !checkingSheets && !sheetCheckFailed && !workspaceError} evidenceNotice={evidenceReadiness.reason} preparingEvidence={pullingGoogle || checkingSheets} onPrepareEvidence={() => pullFromGoogle(importAction.resume)} />}

          <ProjectFileActions importProgressVisible={showProjectImportProgress} page={activePage} detail={Boolean(testCaseId || sheetName)} projectId={selectedProject.id} googleSheetId={selectedProject.googleSheetId || ""} hasSource={Boolean(source)} canEdit={canEditProject} canManage={canManageProject} pulling={pullingGoogle} syncing={syncingGoogle} exporting={exporting} onUpload={() => setShowUpload(true)} onPull={async () => { await pullFromGoogle(); }} onSync={async () => { await syncToGoogle(); }} onDownload={async () => { await downloadResult(); }} />
          {!testCaseId && activePage === "files" && source && <section className="panel workbook-panel">
            <div className="panel-heading"><div><h2>Sheets ในไฟล์ต้นฉบับ</h2><p>ระบบอ่านทุกแท็บและผูก RC / Defect ตาม Test Case ID</p></div><span className="sheet-total">{source.sheets.length || 1} sheets</span></div>
            {source.sheets.length ? <div className="sheet-grid">{source.sheets.map((sheet) => <div className={`sheet-card sheet-${sheet.kind}`} key={sheet.path}><FileSpreadsheet size={15} /><span><strong>{sheet.name}</strong><small>{sheet.kind === "result" ? `${sheet.testCaseIds.join(", ") || "Result"}${sheet.imageCount ? ` · ${sheet.imageCount} รูป` : ""}` : sheet.kind}</small></span></div>)}</div> : <div className="legacy-sheet-note">ไฟล์นี้ถูกอัปโหลดก่อนรองรับหลายชีต กรุณาอัปโหลดไฟล์ต้นฉบับอีกครั้ง</div>}
          </section>}

          {!testCaseId && !sheetName && activePage === "test-cases" && <section className="panel cases-panel" id="cases">
            <div className="cases-heading"><div><h2>Test cases</h2><span>{loadingWorkspace ? "กำลังโหลด…" : `${filteredCaseRows.length} รายการ`}</span></div><div className="table-actions">{canEditProject && <button className="primary-button add-testcase-button" onClick={() => setShowCreateCase(true)}><PlusIcon />เพิ่ม Test Case</button>}<label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="ค้นหาทุกคอลัมน์ของ Testcase" placeholder="ค้นหาทุกคอลัมน์…" /></label><label className="filter-select"><Filter size={16} /><select aria-label="กรองสถานะ Testcase" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TestStatus | "All")}><option value="All">ทุกสถานะ</option>{TEST_STATUSES.map((status) => <option key={status} value={status}>{statusMeta[status].label}</option>)}</select><ChevronDown size={15} /></label></div></div>
            <CaseTableTools columns={caseTableColumns} view={caseTableView} onChange={updateCaseTableView}/>
            {canEditProject && <div style={{padding:"12px 20px"}}><button type="button" className="secondary-button" onClick={()=>dispatchAssignmentMode(editingAssignments ? {type:"close"} : {type:"open",projectId:selectedProjectId ?? ""})}>{editingAssignments ? <Check size={16}/> : <Users size={16}/>} {editingAssignments ? "เสร็จสิ้น" : "แก้ไขผู้รับผิดชอบ"}</button></div>}
            {editingAssignments && <div className="case-assignment-selection"><label className="case-assignment-checkbox"><input type="checkbox" aria-label="เลือกทุกแถวที่แสดงเพื่อมอบหมาย" checked={!!filteredCaseRows.length && filteredCaseRows.every(r=>selectedAssignmentKeys.includes(assignmentRowKey(r.item.id,r.sheetAlias)))} onChange={e=>setAssignmentSelection({projectId:selectedProjectId ?? '',keys:e.target.checked ? [...new Set([...selectedAssignmentKeys,...filteredCaseRows.map(r=>assignmentRowKey(r.item.id,r.sheetAlias))])] : selectedAssignmentKeys.filter(k=>!filteredCaseRows.some(r=>assignmentRowKey(r.item.id,r.sheetAlias)===k))})}/>เลือกทุกแถวที่แสดง</label><span>เลือก {assignmentTargets.length} แถว</span><button type="button" className="secondary-button" disabled={!assignmentTargets.length || assignmentProjectId!==selectedProjectId || !assignmentData || !!assignmentData.error} onClick={()=>setShowCaseAssignment(true)}><Users size={16}/>มอบหมาย QA</button>{selectedAssignmentKeys.length>0 && <button type="button" className="secondary-button" onClick={()=>setAssignmentSelection({projectId:selectedProjectId ?? '',keys:[]})}>ล้างการเลือก</button>}</div>}
            {assignmentProjectId===selectedProjectId && assignmentData?.error && <p className="form-error" role="alert" style={{padding:'0 20px'}}>โหลดผู้รับผิดชอบไม่ได้: {assignmentData.error} · หากยังไม่ได้ติดตั้ง ให้รัน migration personal_test_performance ก่อน</p>}
            <CaseRegisterTable loading={loadingWorkspace} rows={filteredCaseRows} columns={selectedCaseTableColumns} assigneeNames={assigneeNames} associatedSheetNames={item=>(associatedSheetsByCase.get(testCaseIdentity(item.id)) ?? []).map(sheet=>sheet.name)} onOpen={openRegisterRow} editingAssignments={editingAssignments} isSelected={({item,sheetAlias})=>selectedAssignmentKeys.includes(assignmentRowKey(item.id,sheetAlias))} onToggle={({item,sheetAlias},selected)=>toggleAssignment(item.id,sheetAlias,selected)} renderStatus={status=><StatusBadge status={status}/>} hasCases={tableCases.length>0} onUpload={()=>setShowUpload(true)}/>
          </section>}
          {!testCaseId && !sheetName && activePage === "test-cases" && source && <section className="panel workbook-panel non-testcase-sheets-panel">
            <div className="panel-heading"><div><h2>แท็บอื่นใน Google Sheets</h2><p>แสดงเฉพาะแท็บที่ระบบยังผูกกับ Test Case ไม่ได้</p></div><span className="sheet-total">{otherSheets.length} tabs</span></div>
            {otherSheets.length ? <div className="sheet-grid mapping-sheet-grid">{otherSheets.map((sheet) => { const rowState = sheetRowState(sheet.name, activeSheetRowLoads); const invalidMapping = sheetResolution.invalidMappings.find((item) => item.sheet.path === sheet.path)?.mapping; return <article className={`sheet-card sheet-mapping-card sheet-${sheet.kind}`} key={sheet.path}><button type="button" className="sheet-card-open" onClick={() => openTestCaseDetail(`/groups/${groupId}/projects/${selectedProject.id}/sheets/${encodeURIComponent(sheet.name)}`)}><FileSpreadsheet size={15} /><span><strong>{sheet.name}</strong><small>{invalidMapping ? `Mapping เดิม ${invalidMapping.testcaseKey} ไม่พบ Test Case` : `${sheet.kind === "other" ? "ข้อมูลอื่นในไฟล์" : sheet.kind} · กดดูรายละเอียดในเว็บ`}</small><small className={`sheet-row-state sheet-row-${rowState}`}>{sheetImportProgressLabel(rowState, rowLoadProjectId === selectedProjectId ? sheetLoadProgress[sheet.name] : undefined)}</small></span><ChevronRight size={15} /></button>{rowState === "error" && <button type="button" className="secondary-button row-retry" onClick={() => void retrySheetRow(sheet.name)}>ลองโหลดใหม่</button>}<SheetMappingControl key={`${sheet.path}:${invalidMapping?.testcaseKey ?? "unmapped"}`} projectId={selectedProject.id} sheet={sheet} cases={cases} existingMapping={invalidMapping} canEdit={selectedProject.canEdit} onChanged={(mapping) => updateSheetMapping(sheet, mapping)} /></article>; })}</div> : <div className="legacy-sheet-note">ทุกแท็บถูกผูกกับ Test Case แล้ว</div>}
          </section>}
          {!testCaseId && sheetName && !displayedSheetCase && activePage === "test-cases" && source && <section className="panel sheet-detail-page"><div className="sheet-detail-header"><button type="button" className="secondary-button" onClick={returnToTestCases}><ChevronRight size={16} />กลับไป Test cases</button><div><span className="eyebrow">GOOGLE SHEET TAB</span><h2>{decodeURIComponent(sheetName)}</h2><p>รายละเอียดจาก tab ที่ไม่ได้ผูกกับ Test Case</p></div></div>{loadingSheetPreview || !source.bufferLoaded ? <SheetContentShimmer /> : activeSheet ? <ResultSheetViewer source={source} sheet={activeSheet} /> : <div className="empty-state"><FileSpreadsheet size={28} /><strong>ไม่พบ tab นี้</strong><span>ลองกลับไปโหลดรายการจาก Google Sheets อีกครั้ง</span></div>}</section>}

          {!testCaseId && activePage === "defects" && (allDefects.length ? <section className="panel cases-panel"><div className="cases-heading"><div><h2>Defects</h2><span>{allDefects.length} รายการ</span></div></div><div className="defect-list">{allDefects.map((defect) => <article key={defect.id}><div><span className="table-id">{defect.testCaseReference || defect.id}</span><strong>{defect.title}</strong><small>{defect.sourceSheetName ? `จากแท็บ ${defect.sourceSheetName}` : "Defect ของ Test case"}{defect.reporter ? ` · ${defect.reporter}` : ""}</small></div><span className="status-badge status-failed">{defect.status}</span>{defect.description && <p>{defect.description}</p>}{defect.jiraUrl ? <a className="secondary-button" href={defect.jiraUrl} target="_blank" rel="noreferrer">เปิด Jira</a> : <span className="missing-jira">ยังไม่มี Jira URL</span>}</article>)}</div></section> : <section className="panel route-empty-state"><CircleAlert size={34} /><h2>ยังไม่มี Defect</h2><p>เปิด Test case แล้วกด Add Defect เพื่อบันทึกบั๊ก</p></section>)}

          {!testCaseId && activePage === "files" && !source && <section className="panel route-empty-state"><FileArchive size={34} /><h2>ยังไม่มีเอกสารหรือไฟล์ต้นฉบับ</h2><p>{canEditProject ? "อัปโหลด Excel หรือเชื่อม Google Sheets เพื่อเริ่มต้น" : "ยังไม่มีไฟล์ใน Project นี้"}</p>{canEditProject && <button className="primary-button" onClick={() => setShowUpload(true)}><Upload size={16} />อัปโหลดไฟล์</button>}</section>}

          {!testCaseId && activePage === "settings" && <><section className="settings-grid"><article className="panel settings-card"><h2>ข้อมูล Project</h2><dl><div><dt>ชื่อ Project</dt><dd>{selectedProject.name}</dd></div><div><dt>Environment</dt><dd>{selectedProject.environment}</dd></div><div><dt>Google Sheets</dt><dd>{selectedProject.googleSheetUrl || "ยังไม่ได้เชื่อม"}</dd></div></dl>{canManageProject && <button className="secondary-button" onClick={() => setShowGoogleSheetDialog(true)}><Link2 size={16} />ตั้งค่า Google Sheet</button>}</article>{selectedProject.canDelete && <article className="panel settings-card danger-zone"><h2>ลบ Project</h2><p>Test cases, ผลทดสอบ, หลักฐานใน R2 และ Approval จะถูกลบ แต่ Google Sheets จะยังคงอยู่</p><button className="danger-button" onClick={() => void removeSelectedProject()}><Trash2 size={16} />ลบ Project</button></article>}</section><div className="panel project-settings-management"><ProjectManagement key={selectedProject.id} project={selectedProject} onSaved={(project) => { setProjects((current) => current.map((p) => p.id === project.id ? project : p)); router.refresh(); }} /></div></>}
          </>}
        </div>
      </main>
      {canEditProject && showUpload && selectedProject && <UploadDialog onClose={() => setShowUpload(false)} onImported={async (nextCases, nextSource) => {
        const workspace = await persistImportedWorkbook(selectedProject.id, nextCases, nextSource, !selectedProject.googleSheetId);
        setCases(workspace.cases);
        setSource(workspace.source);
        setSearch("");
        setStatusFilter("All");
        setWorkspaceError("");
        flash(`บันทึก ${workspace.cases.length} Testcases ลง Supabase แล้ว`);
      }} />}
      {canEditProject && showCreateCase && selectedProject && <CreateTestCaseDialog existingIds={cases.map((item) => item.id)} nextSourceRow={Math.max(1, ...cases.map((item) => item.sourceRow)) + 1} defaultEnvironment={selectedProject.environment} currentUserName={currentUser?.name ?? ""} onClose={() => setShowCreateCase(false)} onCreated={createTestCase} />}
      {canCreateProject && showProjectDialog && <ProjectDialog groupId={groupId} sprint={planningSprint} draft={projectDraft} draftKey={projectDraftKey} onClose={() => { sessionStorage.removeItem(projectDraftKey); setProjectDraft(null); setShowProjectDialog(false); }} onCreated={(project) => { setProjects((current) => [project, ...current]); setShowProjectDialog(false); router.push(`/groups/${groupId}/projects/${project.id}/overview`); }} />}
      {canManageProject && showGoogleSheetDialog && selectedProject && <GoogleSheetDialog project={selectedProject} onClose={() => setShowGoogleSheetDialog(false)} onConnected={(project) => { setProjects((current) => current.map((item) => item.id === project.id ? project : item)); setShowGoogleSheetDialog(false); flash("เชื่อม Google Sheet แล้ว"); }} />}
      {syncConflictState?.operation === "push" && <SyncConflictDialog operation={syncConflictState.operation} conflicts={syncConflictState.conflicts} onCancel={() => setSyncConflictState(null)} onConfirm={confirmSyncConflicts} />}
      <GoogleCleanupWarning />
      {canEditProject && showCaseAssignment && selectedProject && assignmentProjectId===selectedProject.id && assignmentData && <TestCaseAssignmentDialog projectId={selectedProject.id} targets={assignmentTargets} data={assignmentData} onClose={()=>setShowCaseAssignment(false)} onSaved={()=>{setShowCaseAssignment(false);setAssignmentSelection({projectId:selectedProject.id,keys:[]});setAssignmentVersion(v=>v+1);flash('บันทึกผู้รับผิดชอบราย Test case แล้ว');router.refresh();}}/>}
      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  );
}
