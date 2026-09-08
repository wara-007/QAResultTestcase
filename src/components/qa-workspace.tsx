"use client";

import {
  ArrowDownToLine,
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
  Menu,
  MoreHorizontal,
  Paperclip,
  Search,
  Settings,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Link2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createProject, deleteProject, updateProjectGoogleSheet } from "@/app/actions";
import { signOut } from "@/app/auth/actions";
import { exportTestCases, importTestCases, readWorkbookSheet } from "@/lib/excel-ooxml";
import { loadProjectWorkspace, persistImportedWorkbook, persistTestCaseResult } from "@/lib/project-data";
import { TEST_STATUSES, type CurrentUser, type Project, type TestCase, type TestDefect, type TestResult, type TestStatus, type WorkbookSheet, type WorkbookSheetContent, type WorkbookSource } from "@/lib/types";

const statusMeta: Record<TestStatus, { label: string; className: string }> = {
  "Not Start": { label: "Not Start", className: "status-not-start" },
  "In Progress": { label: "Inprogress", className: "status-in-progress" },
  Pass: { label: "Pass", className: "status-pass" },
  Failed: { label: "Failed", className: "status-failed" },
  Skip: { label: "Skip", className: "status-skip" },
};

export const PROJECT_PAGES = ["overview", "test-cases", "defects", "files", "settings"] as const;
export type ProjectPageName = (typeof PROJECT_PAGES)[number];

type WorkspacePage = "projects" | ProjectPageName;

function mergeGoogleSheetsWithSource(sourceSheets: WorkbookSheet[], googleSheets: WorkbookSheet[]) {
  const sourceByName = new Map(sourceSheets.map((sheet) => [sheet.name.trim().toLowerCase(), sheet]));
  return googleSheets.map((googleSheet) => {
    const sourceSheet = sourceByName.get(googleSheet.name.trim().toLowerCase());
    if (!sourceSheet) return googleSheet;
    return {
      ...googleSheet,
      path: sourceSheet.path,
      imageCount: sourceSheet.imageCount,
    };
  });
}

function StatusBadge({ status }: { status: TestStatus }) {
  const meta = statusMeta[status];
  return <span className={`status-badge ${meta.className}`}><span />{meta.label}</span>;
}

function StatCard({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: number; detail: string; tone: string }) {
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

function ProjectDialog({ groupId, onClose, onCreated }: { groupId: string; onClose: () => void; onCreated: (project: Project) => void }) {
  const [sourceType, setSourceType] = useState<"file" | "url">("file");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sprintNo, setSprintNo] = useState("");
  const [environment, setEnvironment] = useState("UAT");
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const imported = sourceType === "file"
          ? excelFile ? importTestCases(await excelFile.arrayBuffer(), excelFile.name) : null
          : null;
        if (sourceType === "file" && !imported) return setError("กรุณาเลือกไฟล์ Excel");
        const result = await createProject({ groupId, name, description, sprintNo, environment, googleSheetUrl: sourceType === "url" ? googleSheetUrl : "" });
        if (!result.project) return setError(result.error ?? "เพิ่ม Project ไม่สำเร็จ");
        if (imported) await persistImportedWorkbook(result.project.id, imported.cases, imported.source, true);
        onCreated(result.project);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "เพิ่ม Project ไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="project-dialog" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="icon-button close-button" onClick={onClose} aria-label="ปิด"><X size={19} /></button>
        <div className="dialog-heading"><div className="dialog-icon"><FolderKanban size={24} /></div><div><p className="eyebrow">NEW PROJECT</p><h2>เพิ่ม Project</h2></div></div>
        <div className="project-source-tabs" role="tablist" aria-label="แหล่งข้อมูล Testcase">
          <button type="button" role="tab" aria-selected={sourceType === "file"} className={sourceType === "file" ? "active" : ""} onClick={() => setSourceType("file")}><Upload size={16} />อัปโหลด Excel</button>
          <button type="button" role="tab" aria-selected={sourceType === "url"} className={sourceType === "url" ? "active" : ""} onClick={() => setSourceType("url")}><Link2 size={16} />Google Sheets URL</button>
        </div>
        <label className="text-field"><span>ชื่อ Project *</span><input autoFocus required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} placeholder="เช่น IR Cross sell" /></label>
        <label className="text-field"><span>รายละเอียด</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="ขอบเขตหรือเป้าหมายการทดสอบ" /></label>
        {sourceType === "file" ? <label className="project-file-picker"><Upload size={20} /><span><strong>{excelFile?.name ?? "เลือกไฟล์ Excel"}</strong><small>{excelFile ? `${(excelFile.size / 1024 / 1024).toFixed(2)} MB` : "รองรับไฟล์ .xlsx ที่มีชีต Testcase"}</small></span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setExcelFile(event.target.files?.[0] ?? null)} /></label>
          : <label className="text-field"><span>Google Sheet URL *</span><input required value={googleSheetUrl} onChange={(event) => setGoogleSheetUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." /></label>}
        <div className="two-column-fields">
          <label><span>Sprint</span><input value={sprintNo} onChange={(event) => setSprintNo(event.target.value)} placeholder="เช่น Sprint 41" /></label>
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
    <p className="dialog-help">แชร์ Sheet ให้ Service Account เป็น Editor ก่อนเชื่อม</p>
    {error && <p className="form-error"><CircleAlert size={16} />{error}</p>}
    <footer className="dialog-footer"><button type="button" className="secondary-button" onClick={onClose}>ยกเลิก</button><button className="primary-button" disabled={pending}>{pending && <LoaderCircle className="spin" size={17} />}เชื่อม Sheet</button></footer>
  </form></div>;
}

function ProjectsHome({ projects, error, onAdd, projectHref }: { projects: Project[]; error: string; onAdd: () => void; projectHref: (project: Project) => string }) {
  return (
    <div className="projects-home" id="projects">
      <section className="projects-heading"><div><p className="eyebrow">WORKSPACE</p><h1>Projects</h1><span>เลือก Project เพื่อดู Testcase หรือสร้าง Project ใหม่</span></div><button className="primary-button" onClick={onAdd}><PlusIcon />เพิ่ม Project</button></section>
      {error ? <section className="project-error"><CircleAlert size={20} /><div><strong>โหลด Projects ไม่สำเร็จ</strong><span>{error}</span></div></section> : projects.length ? <section className="project-grid">{projects.map((project) => <Link className="project-card" key={project.id} href={projectHref(project)}><div className="project-card-icon"><FolderKanban size={22} /></div><div className="project-card-title"><h2>{project.name}</h2><ChevronRight size={18} /></div><p>{project.description || "ไม่มีรายละเอียด"}</p><div className="project-card-meta"><span>{project.environment}</span>{project.sprintNo && <span>{project.sprintNo}</span>}</div><small>สร้างเมื่อ {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(project.createdAt))}</small></Link>)}</section> : <section className="panel project-zero"><FolderKanban size={34} /><h2>ยังไม่มี Project</h2><p>สร้าง Project แรกเพื่ออัปโหลด Testcase และเริ่มบันทึกผล</p><button className="primary-button" onClick={onAdd}><PlusIcon />เพิ่ม Project</button></section>}
    </div>
  );
}

function PlusIcon() {
  return <span className="plus-icon" aria-hidden>+</span>;
}

function ResultSheetViewer({ source, sheet }: { source: WorkbookSource; sheet: WorkbookSheet }) {
  const result = useMemo<{ content: WorkbookSheetContent | null; error: string }>(() => {
    try {
      return { content: readWorkbookSheet(source, sheet), error: "" };
    } catch (reason) {
      return { content: null, error: reason instanceof Error ? reason.message : "อ่านข้อมูลใน sheet ไม่สำเร็จ" };
    }
  }, [sheet, source]);
  const imageUrls = useMemo(() => (result.content?.images ?? []).map((item) => ({ name: item.name, url: URL.createObjectURL(new Blob([new Uint8Array(item.bytes)], { type: item.mimeType })) })), [result.content]);
  useEffect(() => {
    return () => imageUrls.forEach((item) => URL.revokeObjectURL(item.url));
  }, [imageUrls]);

  const content = result.content;
  if (result.error) return <p className="form-error"><CircleAlert size={16} />{result.error}</p>;
  if (!content) return null;
  return <div className="sheet-viewer">
    {imageUrls.length > 0 && <div className="evidence-gallery">{imageUrls.map((item, index) => <a href={item.url} target="_blank" rel="noreferrer" key={`${item.name}-${index}`}><Image src={item.url} alt={`หลักฐานจาก ${sheet.name} รูปที่ ${index + 1}`} width={900} height={600} unoptimized /></a>)}</div>}
    {content.cells.length > 0 && <details><summary>ข้อมูลใน sheet ({content.cells.length}{content.truncatedCellCount ? "+" : ""} cells)</summary><div className="sheet-cell-list">{content.cells.map((cell) => <div key={cell.ref}><strong>{cell.ref}</strong><pre>{cell.value}</pre></div>)}</div></details>}
  </div>;
}

function CaseDrawer({ value, projectId, source, currentUserName, pageMode = false, onClose, onSave, onSaveResult }: { value: TestCase; projectId: string; source: WorkbookSource | null; currentUserName: string; pageMode?: boolean; onClose: () => void; onSave: (value: TestCase) => Promise<void>; onSaveResult: (value: TestCase) => Promise<TestCase> }) {
  const [draft, setDraft] = useState<TestCase>(() => {
    let remembered: { platform?: string; environment?: string; device?: string; appVersion?: string; testData?: string } = {};
    try { remembered = JSON.parse(window.localStorage.getItem(`qa-test-defaults:${projectId}`) ?? "{}"); } catch { /* ใช้ค่าเดิมเมื่อ localStorage ไม่พร้อม */ }
    return {
      ...value,
      platform: value.platform || remembered.platform || "",
      environment: value.environment || remembered.environment || "",
      device: value.device || remembered.device || "",
      appVersion: value.appVersion || remembered.appVersion || "",
      testData: value.testData || remembered.testData || "",
      executedBy: currentUserName,
    };
  });
  const [actualResult, setActualResult] = useState("");
  const [apiResponse, setApiResponse] = useState("");
  const [log, setLog] = useState("");
  const [defectTitle, setDefectTitle] = useState("");
  const [defectResult, setDefectResult] = useState("");
  const [defectStatus, setDefectStatus] = useState("Open");
  const [jiraUrl, setJiraUrl] = useState("");
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [editingDefectId, setEditingDefectId] = useState<string | null>(null);
  const [showResultEntry, setShowResultEntry] = useState(false);
  const [showDefectEntry, setShowDefectEntry] = useState(false);
  const [savingResult, setSavingResult] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [error, setError] = useState("");
  const [viewingSheet, setViewingSheet] = useState<WorkbookSheet | null>(null);
  const evidenceInput = useRef<HTMLInputElement>(null);
  const resultSheets = source?.sheets.filter((sheet) => sheet.testCaseIds.includes(value.id.toUpperCase())) ?? [];
  const evidenceCount = resultSheets.reduce((total, sheet) => total + sheet.imageCount, 0);
  const update = (field: keyof TestCase, next: string) => setDraft((current) => ({ ...current, [field]: next }));
  const rememberDefaults = (testCase: TestCase) => window.localStorage.setItem(`qa-test-defaults:${projectId}`, JSON.stringify({ platform: testCase.platform, environment: testCase.environment, device: testCase.device, appVersion: testCase.appVersion, testData: testCase.testData }));
  function resetResultForm() {
    setActualResult("");
    setApiResponse("");
    setLog("");
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
    if (!actualResult.trim() && !apiResponse.trim() && !log.trim() && !draft.evidence.length) {
      setError("กรุณาใส่ผลทดสอบ รูป API response หรือ log อย่างน้อยหนึ่งรายการ");
      return;
    }
    const createdAt = new Date().toISOString();
    const result: TestResult = {
      id: crypto.randomUUID(),
      status: draft.status,
      actualResult: actualResult.trim(),
      apiResponse: apiResponse.trim(),
      log: log.trim(),
      evidence: draft.evidence,
      createdAt,
    };
    const next = {
      ...draft,
      executedBy: currentUserName.trim() || draft.executedBy,
      remark: actualResult.trim() || draft.remark,
      evidence: [],
      results: editingResultId
        ? (draft.results ?? []).map((item) => item.id === editingResultId ? { ...result, id: editingResultId, createdAt: item.createdAt } : item)
        : [...(draft.results ?? []), result],
    };
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
    setShowResultEntry(false);
    setEditingResultId(result.id);
    setActualResult(result.actualResult);
    setApiResponse(result.apiResponse);
    setLog(result.log);
    setDraft((current) => ({ ...current, evidence: result.evidence }));
  }
  async function saveDefect() {
    if (!defectTitle.trim()) return setError("กรุณาใส่ชื่อ Defect");
    if (!defectResult.trim() && !apiResponse.trim() && !log.trim() && !draft.evidence.length) return setError("กรุณาใส่ Result รูป API response หรือ log ของ Defect อย่างน้อยหนึ่งรายการ");
    const defect: TestDefect = {
      id: crypto.randomUUID(), title: defectTitle.trim(), description: defectResult.trim(), status: defectStatus,
      jiraUrl: jiraUrl.trim(), apiResponse: apiResponse.trim(), log: log.trim(), evidence: draft.evidence, createdAt: new Date().toISOString(),
    };
    const next = {
      ...draft, executedBy: currentUserName.trim() || draft.executedBy, evidence: [],
      defects: editingDefectId
        ? (draft.defects ?? []).map((item) => item.id === editingDefectId ? { ...defect, id: item.id, createdAt: item.createdAt } : item)
        : [...(draft.defects ?? []), defect],
    };
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
      const saved = await onSaveResult({ ...draft, evidence: [], results: (draft.results ?? []).filter((item) => item.id !== result.id) });
      setDraft(saved);
      if (editingResultId === result.id) resetResultForm();
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
      const next = { ...draft, executedBy: currentUserName.trim() || draft.executedBy };
      rememberDefaults(next);
      await onSave(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึกผลไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }
  async function uploadEvidence(file?: File) {
    if (!file) return;
    setUploadingEvidence(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("testCaseId", draft.id);
      form.set("sourceRow", String(draft.sourceRow));
      form.set("evidence", JSON.stringify(draft.evidence));
      const response = await fetch(`/api/projects/${projectId}/evidence`, { method: "POST", body: form });
      const data = await response.json();
      if (response.status === 401 && data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
      if (!response.ok) throw new Error(data.error ?? "อัปโหลดรูปไม่สำเร็จ");
      setDraft((current) => ({ ...current, evidence: [...current.evidence, data.evidence] }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploadingEvidence(false);
      if (evidenceInput.current) evidenceInput.current.value = "";
    }
  }
  function renderResultFields(submitLabel: string, onCancel?: () => void) {
    return <>
      <label className="text-field"><span>ผลที่พบ / Actual result</span><textarea rows={3} value={actualResult} onChange={(event) => setActualResult(event.target.value)} placeholder="รายละเอียดผลทดสอบรอบนี้" /></label>
      <div className="result-input-grid"><label className="text-field"><span>API response</span><textarea className="code-input" rows={7} value={apiResponse} onChange={(event) => setApiResponse(event.target.value)} placeholder="วาง response JSON หรือข้อความ" /></label>
      <label className="text-field"><span>Log</span><textarea className="code-input" rows={7} value={log} onChange={(event) => setLog(event.target.value)} placeholder="วาง application log" /></label></div>
      <div className="result-evidence-entry">
        <span className="field-label">รูปหลักฐานของ Result นี้</span>
        {draft.evidence.length > 0 && <div className="drive-evidence-gallery">{draft.evidence.map((item) => <a href={`/api/google/evidence/${item.fileId}`} target="_blank" rel="noreferrer" key={item.fileId}><Image src={`/api/google/evidence/${item.fileId}`} alt={item.name} width={500} height={350} unoptimized /><span>{item.name}</span></a>)}</div>}
        <button type="button" className="attachment-button" onClick={() => evidenceInput.current?.click()} disabled={uploadingEvidence}><Paperclip size={17} />{uploadingEvidence ? "กำลังอัปโหลดไป Google Drive..." : "เพิ่มรูปหลักฐานให้ Result นี้"}<span>{draft.evidence.length} รูป</span></button>
        <input ref={evidenceInput} type="file" accept="image/*" hidden onChange={(event) => void uploadEvidence(event.target.files?.[0])} />
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
      <div className="result-evidence-entry"><span className="field-label">รูปหลักฐานของ Defect นี้</span>{draft.evidence.length > 0 && <div className="drive-evidence-gallery">{draft.evidence.map((item) => <a href={`/api/google/evidence/${item.fileId}`} target="_blank" rel="noreferrer" key={item.fileId}><Image src={`/api/google/evidence/${item.fileId}`} alt={item.name} width={500} height={350} unoptimized /><span>{item.name}</span></a>)}</div>}<button type="button" className="attachment-button" onClick={() => evidenceInput.current?.click()} disabled={uploadingEvidence}><Paperclip size={17} />{uploadingEvidence ? "กำลังอัปโหลดไป Google Drive..." : "เพิ่มรูปหลักฐานให้ Defect นี้"}<span>{draft.evidence.length} รูป</span></button><input ref={evidenceInput} type="file" accept="image/*" hidden onChange={(event) => void uploadEvidence(event.target.files?.[0])} /></div>
      <div className="two-column-fields"><label><span>สถานะ Defect</span><select value={defectStatus} onChange={(event) => setDefectStatus(event.target.value)}><option>Open</option><option>In Progress</option><option>Resolved</option><option>Closed</option></select></label><label><span>Jira card URL</span><input type="url" value={jiraUrl} onChange={(event) => setJiraUrl(event.target.value)} placeholder="https://...atlassian.net/browse/..." /></label></div>
      <div className="result-editor-actions">{onCancel && <button className="secondary-button" type="button" onClick={onCancel} disabled={savingResult}>ยกเลิกการแก้ไข</button>}<button className="primary-button add-result-button" type="button" onClick={() => void saveDefect()} disabled={savingResult}>{savingResult ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{submitLabel}</button></div>
    </>;
  }
  return (
    <div className={`drawer-backdrop ${pageMode ? "case-route-backdrop" : ""}`} role="presentation" onMouseDown={pageMode ? undefined : onClose}>
      <aside className={`case-drawer ${pageMode ? "case-route-editor" : ""}`} role="dialog" aria-modal="true" aria-labelledby="case-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="drawer-header">
          <div><span className="case-id">{draft.id}</span><h2 id="case-title">{draft.name}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="ปิด"><X size={20} /></button>
        </header>
        <div className="drawer-body">
          <div className="case-context"><span>{draft.platform || "ไม่ระบุ Platform"}</span><span>{draft.environment || "ไม่ระบุ Env"}</span><span>{draft.appVersion || "ไม่ระบุ Build"}</span></div>
          <section className="readonly-block"><p>เงื่อนไข</p><div>{draft.condition || "—"}</div></section>
          <section className="readonly-block"><p>ขั้นตอนทดสอบ</p><div className="multiline">{draft.steps || "—"}</div></section>
          <section className="readonly-block expected"><p>ผลลัพธ์ที่คาดหวัง</p><div className="multiline">{draft.expected || "—"}</div></section>
          <div className="form-section-title"><span>บันทึกผลการทดสอบ</span><span className="required-note">* จำเป็น</span></div>
          <div className="two-column-fields">
            <label><span>Platform</span><input value={draft.platform} onChange={(event) => update("platform", event.target.value)} placeholder="เช่น Mobile, Web, iOS/Android" /></label>
            <label><span>Environment</span><input value={draft.environment} onChange={(event) => update("environment", event.target.value)} placeholder="เช่น UAT, SIT, Production" /></label>
          </div>
          <div className="two-column-fields">
            <label><span>Device</span><select value={draft.device} onChange={(event) => update("device", event.target.value)}><option value="">เลือก Device</option><option value="iOS">iOS</option><option value="Android">Android</option><option value="iOS/Android">iOS/Android</option></select></label>
            <label><span>App version</span><input value={draft.appVersion} onChange={(event) => update("appVersion", event.target.value)} placeholder="Build number" /></label>
          </div>
          <label className="text-field"><span>ผู้ทดสอบ</span><input value={draft.executedBy || currentUserName} readOnly aria-readonly="true" title="ใช้ชื่อจากบัญชี Google ที่ Login" /></label>
          <label className="text-field"><span>Test data</span><input value={draft.testData} onChange={(event) => update("testData", event.target.value)} /></label>
          <label className="text-field"><span>หมายเหตุ / Actual result</span><textarea rows={4} value={draft.remark} onChange={(event) => update("remark", event.target.value)} placeholder="บันทึกสิ่งที่พบระหว่างการทดสอบ..." /></label>
          {showResultEntry && <div className="result-entry-block">
            <div className="result-form-heading"><div><span>{`เพิ่ม Result ให้ ${draft.id}`}</span><small>{draft.name}</small></div><strong>{draft.results?.length ?? 0} results</strong></div>
            {renderResultFields("บันทึก Result รายการนี้")}
          </div>}
          {(draft.results?.length ?? 0) > 0 && <div className="result-preview-list">
            <div className="result-sheet-heading"><span>Preview Results</span><strong>{draft.results?.length} รายการ</strong></div>
            {draft.results?.map((result, index) => <article key={result.id} className={editingResultId === result.id ? "editing" : ""}><header><strong>ผลที่ {index + 1}</strong><StatusBadge status={result.status} /><time>{new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.createdAt))}</time>{editingResultId !== result.id && <><button type="button" className="secondary-button result-edit-button" onClick={() => editResult(result)}>แก้ไข</button><button type="button" className="danger-button result-delete-button" disabled={savingResult} onClick={() => void deleteResult(result)}><Trash2 size={13} />ลบ</button></>}</header>{editingResultId === result.id ? <div className="result-entry-block inline-result-editor"><div className="result-form-heading"><div><span>{`แก้ไขผลที่ ${index + 1} ของ ${draft.id}`}</span><small>บันทึกแล้วจะแทนที่ Result รายการนี้</small></div></div>{renderResultFields("บันทึกการแก้ไข Result", resetResultForm)}</div> : <>{result.actualResult && <p>{result.actualResult}</p>}{result.apiResponse && <details><summary>API response</summary><pre>{result.apiResponse}</pre></details>}{result.log && <details><summary>Log</summary><pre>{result.log}</pre></details>}{result.evidence.length > 0 && <div className="drive-evidence-gallery result-evidence-gallery">{result.evidence.map((item) => <a href={`/api/google/evidence/${item.fileId}`} target="_blank" rel="noreferrer" key={item.fileId}><Image src={`/api/google/evidence/${item.fileId}`} alt={item.name} width={500} height={350} unoptimized /><span>{item.name}</span></a>)}</div>}</>}</article>)}
          </div>}
          {!showResultEntry && !editingResultId && !showDefectEntry && !editingDefectId && <div className="entry-type-actions"><button type="button" className="primary-button open-result-button" onClick={() => { resetResultForm(); setShowResultEntry(true); }}><PlusIcon />Add Result</button><button type="button" className="secondary-button add-defect-button" onClick={() => { resetResultForm(); setShowDefectEntry(true); }}><CircleAlert size={16} />Add Defect</button></div>}
          {showDefectEntry && <div className="result-entry-block defect-entry"><div className="result-form-heading"><div><span>{`เพิ่ม Defect ให้ ${draft.id}`}</span><small>Defect นี้จะผูกกับ Test case โดยตรง</small></div><strong>{draft.defects?.length ?? 0} defects</strong></div>{renderDefectFields("บันทึก Defect รายการนี้", resetResultForm)}</div>}
          {(draft.defects?.length ?? 0) > 0 && <div className="result-preview-list defect-preview-list"><div className="result-sheet-heading"><span>Defects ของ Test case</span><strong>{draft.defects?.length} รายการ</strong></div>{draft.defects?.map((defect, index) => <article key={defect.id} className={editingDefectId === defect.id ? "editing" : ""}><header><strong>Defect {index + 1}: {defect.title}</strong><span className="status-badge status-failed">{defect.status}</span><time>{new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(defect.createdAt))}</time>{editingDefectId !== defect.id && <><button type="button" className="secondary-button result-edit-button" onClick={() => editDefect(defect)}>แก้ไข</button><button type="button" className="danger-button result-delete-button" disabled={savingResult} onClick={() => void deleteDefect(defect)}><Trash2 size={13} />ลบ</button></>}</header>{editingDefectId === defect.id ? <div className="result-entry-block inline-result-editor">{renderDefectFields("บันทึกการแก้ไข Defect", resetResultForm)}</div> : <>{defect.description && <p>{defect.description}</p>}{defect.apiResponse && <details><summary>API response</summary><pre>{defect.apiResponse}</pre></details>}{defect.log && <details><summary>Log</summary><pre>{defect.log}</pre></details>}{defect.evidence.length > 0 && <div className="drive-evidence-gallery result-evidence-gallery">{defect.evidence.map((item) => <a href={`/api/google/evidence/${item.fileId}`} target="_blank" rel="noreferrer" key={item.fileId}><Image src={`/api/google/evidence/${item.fileId}`} alt={item.name} width={500} height={350} unoptimized /><span>{item.name}</span></a>)}</div>}{defect.jiraUrl && <a className="secondary-button" href={defect.jiraUrl} target="_blank" rel="noreferrer">เปิด Jira</a>}</>}</article>)}</div>}
          <div className="result-sheet-block">
            <div className="result-sheet-heading"><span>ผลและหลักฐานจาก Excel</span><strong>{resultSheets.length} sheets · {evidenceCount} รูป</strong></div>
            {resultSheets.length ? <div className="result-sheet-list">{resultSheets.map((sheet) => <button className={viewingSheet?.path === sheet.path ? "active" : ""} onClick={() => setViewingSheet(sheet)} key={sheet.path}><FileSpreadsheet size={16} /><span><strong>{sheet.name}</strong><small>{sheet.imageCount ? `${sheet.imageCount} รูปหลักฐาน` : "ไม่มีรูปในชีต"}</small></span><ChevronRight size={15} /></button>)}</div> : <p className="no-result-sheet">ไม่พบชีตผลลัพธ์ที่อ้างอิง {value.id}</p>}
            {viewingSheet && source && <ResultSheetViewer key={viewingSheet.path} source={source} sheet={viewingSheet} />}
          </div>
          <label className="field-label">สถานะผลทดสอบ</label>
          <div className="status-picker">
            {TEST_STATUSES.map((status) => (
              <button type="button" key={status} className={draft.status === status ? "selected" : ""} onClick={() => setDraft((current) => ({ ...current, status }))}>
                <span className={`picker-dot ${statusMeta[status].className}`} />{statusMeta[status].label}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="form-error"><CircleAlert size={16} />{error}</p>}
        <footer className="drawer-footer"><button className="secondary-button" onClick={onClose} disabled={saving}>ยกเลิก</button><button className="primary-button" onClick={() => void save()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}บันทึกผล</button></footer>
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
}: {
  configured: boolean;
  initialProjects: Project[];
  projectsError: string;
  groupId: string;
  selectedProjectId?: string;
  activePage: WorkspacePage;
  currentUser: CurrentUser | null;
  testCaseId?: string;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const [cases, setCases] = useState<TestCase[]>([]);
  const [source, setSource] = useState<WorkbookSource | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(Boolean(selectedProjectId));
  const [workspaceError, setWorkspaceError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TestStatus | "All">("All");
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showGoogleSheetDialog, setShowGoogleSheetDialog] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [exporting, setExporting] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [pullingGoogle, setPullingGoogle] = useState(false);
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const currentEnvironment = cases.find((item) => item.environment.trim())?.environment ?? selectedProject?.environment;
  const workbookStats = useMemo(() => ({
    results: source?.sheets.filter((sheet) => sheet.kind === "result").length ?? 0,
    images: source?.sheets.reduce((total, sheet) => total + sheet.imageCount, 0) ?? 0,
  }), [source]);

  const counts = useMemo(() => Object.fromEntries(TEST_STATUSES.map((status) => [status, cases.filter((item) => item.status === status).length])) as Record<TestStatus, number>, [cases]);
  const completed = counts.Pass + counts.Failed + counts.Skip;
  const progress = cases.length ? Math.round((completed / cases.length) * 100) : 0;
  const filteredCases = useMemo(() => cases.filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${item.id} ${item.name} ${item.scenario}`.toLowerCase().includes(query);
    return matchesSearch && (statusFilter === "All" || item.status === statusFilter);
  }), [cases, search, statusFilter]);
  const allDefects = useMemo(() => cases.flatMap((testCase) => (testCase.defects ?? []).map((defect) => ({ ...defect, testCaseId: testCase.id }))), [cases]);
  const activeSelectedCase = testCaseId
    ? cases.find((item) => item.id.toUpperCase() === decodeURIComponent(testCaseId).toUpperCase()) ?? null
    : selectedCase;

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  useEffect(() => {
    if (!selectedProject) return;
    let active = true;
    const googleRequest = selectedProject.googleSheetId
      ? fetch(`/api/projects/${selectedProject.id}/google-sheet`, { cache: "no-store" }).then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "โหลด Google Sheet ไม่สำเร็จ");
          return data as { cases: TestCase[]; sheets: WorkbookSource["sheets"] };
        })
      : Promise.resolve(null);
    void Promise.allSettled([loadProjectWorkspace(selectedProject.id), googleRequest])
      .then(([workspaceResult, googleResult]) => {
        if (!active) return;
        if (workspaceResult.status === "rejected") throw workspaceResult.reason;
        const workspace = workspaceResult.value;
        const googleWorkspace = googleResult.status === "fulfilled" ? googleResult.value : null;
        const storedById = new Map(workspace.cases.map((item) => [item.id.toUpperCase(), item]));
        const mergedCases = googleWorkspace?.cases.map((item) => {
          const stored = storedById.get(item.id.toUpperCase());
          const hasStoredResults = Boolean(stored?.results?.length);
          const hasStoredDefects = Boolean(stored?.defects?.length);
          const useStoredFields = Boolean(stored?.persistedLocally || hasStoredResults || hasStoredDefects);
          return stored ? {
            ...item,
            recordId: stored.recordId,
            executionId: stored.executionId,
            persistedLocally: stored.persistedLocally,
            results: hasStoredResults ? stored.results : item.results,
            defects: hasStoredDefects ? stored.defects : item.defects,
            evidence: stored.evidence,
            platform: useStoredFields ? stored.platform : item.platform,
            status: useStoredFields ? stored.status : item.status,
            device: useStoredFields ? stored.device : item.device,
            appVersion: useStoredFields ? stored.appVersion : item.appVersion,
            environment: useStoredFields ? stored.environment : item.environment,
            remark: useStoredFields ? stored.remark : item.remark,
            executedBy: useStoredFields ? (stored.executedBy || currentUser?.name || item.executedBy) : item.executedBy,
          } : item;
        }) ?? workspace.cases;
        setCases(mergedCases);
        setSource(workspace.source ? {
          ...workspace.source,
          sheets: googleWorkspace
            ? mergeGoogleSheetsWithSource(workspace.source.sheets, googleWorkspace.sheets)
            : workspace.source.sheets,
        } : workspace.source);
        setHasUnsyncedChanges(false);
        if (googleResult.status === "rejected") {
          const message = googleResult.reason instanceof Error ? googleResult.reason.message : "โหลด Google Sheet ไม่สำเร็จ";
          setWorkspaceError(`ยังโหลดข้อมูลเดิมได้ แต่ Google Sheets ยังไม่พร้อม: ${message}`);
        }
      })
      .catch((reason) => {
        if (!active) return;
        setWorkspaceError(reason instanceof Error ? reason.message : "โหลด Testcase ไม่สำเร็จ");
      })
      .finally(() => {
        if (active) setLoadingWorkspace(false);
      });
    return () => { active = false; };
  }, [selectedProject, currentUser?.name]);

  async function saveCase(next: TestCase) {
    if (!selectedProject) throw new Error("กรุณาเลือก Project");
    const saved = await persistTestCaseResult(selectedProject.id, next);
    setCases((current) => current.map((item) => item.id === saved.id ? saved : item));
    setSelectedCase(null);
    if (selectedProject.googleSheetId) {
      setHasUnsyncedChanges(true);
      flash(`บันทึก ${saved.id} แล้ว · รอซิงค์กลับ Google Sheets`);
    } else {
      flash(`บันทึกผล ${saved.id} ลง Supabase แล้ว`);
    }
    if (testCaseId) router.push(`/groups/${groupId}/projects/${selectedProject.id}/test-cases`);
  }

  async function saveResult(next: TestCase) {
    if (!selectedProject) throw new Error("กรุณาเลือก Project");
    const saved = await persistTestCaseResult(selectedProject.id, next);
    setCases((current) => current.map((item) => item.id === saved.id ? saved : item));
    setSelectedCase(saved);
    if (selectedProject.googleSheetId) setHasUnsyncedChanges(true);
    flash(`บันทึก Result ของ ${saved.id} ลง Supabase แล้ว`);
    return saved;
  }

  async function pullFromGoogle() {
    if (!selectedProject?.googleSheetId) return setShowGoogleSheetDialog(true);
    if (hasUnsyncedChanges && !window.confirm("มีผลทดสอบที่ยังไม่ได้ซิงค์ การโหลดใหม่จะทับข้อมูลเหล่านั้น ต้องการดำเนินการต่อหรือไม่?")) return;
    setPullingGoogle(true);
    try {
      const [response, workbookResponse] = await Promise.all([
        fetch(`/api/projects/${selectedProject.id}/google-sheet`, { cache: "no-store" }),
        fetch(`/api/projects/${selectedProject.id}/google-sheet/workbook`, { cache: "no-store" }),
      ]);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "โหลด Google Sheet ไม่สำเร็จ");
      if (!workbookResponse.ok) {
        const workbookError = await workbookResponse.json().catch(() => null) as { error?: string } | null;
        throw new Error(workbookError?.error ?? "โหลดรูปจาก Google Sheets ไม่สำเร็จ");
      }
      const imported = importTestCases(await workbookResponse.arrayBuffer(), `${selectedProject.name}.xlsx`);
      setCases(data.cases);
      setSource({
        ...imported.source,
        sheets: mergeGoogleSheetsWithSource(imported.source.sheets, data.sheets),
      });
      setHasUnsyncedChanges(false);
      const imageCount = imported.source.sheets.reduce((total, sheet) => total + sheet.imageCount, 0);
      flash(`โหลด ${data.cases.length} Testcases และ ${imageCount} รูปจาก Google Sheets แล้ว`);
    } catch (reason) {
      flash(reason instanceof Error ? reason.message : "โหลด Google Sheet ไม่สำเร็จ");
    } finally {
      setPullingGoogle(false);
    }
  }

  async function syncToGoogle() {
    if (!selectedProject?.googleSheetId) return setShowGoogleSheetDialog(true);
    setSyncingGoogle(true);
    try {
      const response = await fetch(`/api/projects/${selectedProject.id}/google-sheet`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cases }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "ซิงค์ Google Sheet ไม่สำเร็จ");
      setHasUnsyncedChanges(false);
      flash(`ซิงค์แล้ว ${data.updatedCells} cells · ${data.resultSheets ?? 0} result sheets · ${data.defects ?? 0} defects`);
    } catch (reason) {
      flash(reason instanceof Error ? reason.message : "ซิงค์ Google Sheet ไม่สำเร็จ");
    } finally {
      setSyncingGoogle(false);
    }
  }

  async function removeSelectedProject() {
    if (!selectedProject || !window.confirm(`ลบ Project “${selectedProject.name}” พร้อมข้อมูลและไฟล์ต้นฉบับทั้งหมดหรือไม่? การดำเนินการนี้ย้อนกลับไม่ได้`)) return;
    const project = selectedProject;
    const result = await deleteProject(project.id);
    if ("error" in result) return flash(result.error ?? "ลบ Project ไม่สำเร็จ");
    setProjects((current) => current.filter((item) => item.id !== project.id));
    setCases([]);
    setSource(null);
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
      const bytes = exportTestCases(source, cases);
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = source.fileName.replace(/\.xlsx$/i, "_result.xlsx");
      anchor.click();
      URL.revokeObjectURL(url);
      flash("สร้างไฟล์ผลการทดสอบแล้ว");
    } catch {
      flash("สร้างไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง");
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
            <Link href="/groups"><Users size={19} />Groups</Link>
            <Link className="active" href={`/groups/${groupId}/projects`}><FolderKanban size={19} />Projects<span className="nav-count">{projects.length}</span></Link>
          </nav>
          <div className="sidebar-footer"><button><Settings size={18} />ตั้งค่ากลุ่ม</button></div>
        </> : <>
          <div className="sidebar-section project-context">
            <Link className="back-to-projects" href={`/groups/${groupId}/projects`}><ChevronRight size={15} />กลับไป Projects</Link>
            <label className="project-switcher"><span>PROJECT</span><select value={selectedProject.id} onChange={(event) => router.push(`/groups/${groupId}/projects/${event.target.value}/overview`)}>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
          </div>
          <nav className="main-nav project-nav" aria-label="Project Workspace">
            <p className="nav-heading">PROJECT WORKSPACE</p>
            <Link className={activePage === "overview" ? "active" : ""} href={`/groups/${groupId}/projects/${selectedProject.id}/overview`}><LayoutDashboard size={19} />ภาพรวม</Link>
            <Link className={activePage === "test-cases" ? "active" : ""} href={`/groups/${groupId}/projects/${selectedProject.id}/test-cases`}><ClipboardCheck size={19} />Test cases<span className="nav-count">{cases.length}</span></Link>
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
          <div className="breadcrumb"><Link href="/groups">Groups</Link><ChevronRight size={15} /><Link href={`/groups/${groupId}/projects`}>Projects</Link>{selectedProject && <><ChevronRight size={15} /><strong>{selectedProject.name}</strong></>}</div>
          <div className="topbar-actions">{selectedProject && currentEnvironment && <span className="environment-pill"><span />{currentEnvironment}</span>}</div>
        </header>

        <div className="page-content" id="dashboard">
          {!selectedProject ? <ProjectsHome projects={projects} error={projectsError} onAdd={() => setShowProjectDialog(true)} projectHref={(project) => `/groups/${groupId}/projects/${project.id}/overview`} /> : <>
          <section className="page-heading"><div><div className="title-line"><h1>{activePage === "overview" ? selectedProject.name : ({ "test-cases": "Test cases", defects: "Defects", files: "เอกสาร/ไฟล์", settings: "ตั้งค่า Project" } as Record<string, string>)[activePage]}</h1>{selectedProject.sprintNo && <span className="sprint-pill">{selectedProject.sprintNo}</span>}{hasUnsyncedChanges && <span className="unsynced-pill">ยังไม่ Sync</span>}</div><p>{activePage === "overview" ? (selectedProject.description || "ภาพรวมการทดสอบของ Project") : selectedProject.name}</p></div><div className="heading-actions google-actions">
            {activePage === "files" && <button className="secondary-button" onClick={() => setShowUpload(true)}><Upload size={17} />ไฟล์ต้นฉบับ</button>}
            <button className="secondary-button" onClick={() => void pullFromGoogle()} disabled={pullingGoogle}>{pullingGoogle ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}{selectedProject.googleSheetId ? "โหลดจาก Sheets" : "เชื่อม Google Sheet"}</button>
            {selectedProject.googleSheetId && <button className="sync-button" onClick={() => void syncToGoogle()} disabled={syncingGoogle}>{syncingGoogle ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}ซิงค์กลับ Google Sheets</button>}
            {(activePage === "test-cases" || activePage === "files") && <button className="primary-button" onClick={() => void downloadResult()} disabled={exporting}>{exporting ? <LoaderCircle className="spin" size={17} /> : <ArrowDownToLine size={17} />}{source ? "ดาวน์โหลด Result" : "เชื่อมไฟล์ต้นฉบับ"}</button>}
          </div></section>

          {loadingWorkspace && <div className="source-banner"><LoaderCircle className="spin" size={18} /><div><strong>กำลังโหลดข้อมูลจาก Supabase</strong><span>กำลังโหลด Testcase และไฟล์ต้นฉบับของ Project</span></div></div>}
          {workspaceError && <section className="project-error"><CircleAlert size={20} /><div><strong>โหลดข้อมูล Project ไม่สำเร็จ</strong><span>{workspaceError}</span></div></section>}
          {!loadingWorkspace && source && (activePage === "test-cases" || activePage === "files") && <div className="source-banner"><FileArchive size={18} /><div><strong>{source.fileName}</strong><span>อ่านแล้ว {source.sheets.length || 1} sheets · {cases.length} cases · {workbookStats.results} result sheets · {workbookStats.images} รูป</span></div><CheckCircle2 size={18} /></div>}

          {testCaseId && activeSelectedCase && <CaseDrawer value={activeSelectedCase} projectId={selectedProject.id} source={source} currentUserName={currentUser?.name ?? ""} pageMode onClose={() => router.push(`/groups/${groupId}/projects/${selectedProject.id}/test-cases`)} onSave={saveCase} onSaveResult={saveResult} />}

          {!testCaseId && activePage === "overview" && <><section className="stats-grid">
            <StatCard icon={<ClipboardCheck size={21} />} label="Test cases ทั้งหมด" value={cases.length} detail="ในรอบทดสอบนี้" tone="blue" />
            <StatCard icon={<CheckCircle2 size={21} />} label="ผ่าน" value={counts.Pass} detail={`${cases.length ? Math.round(counts.Pass / cases.length * 100) : 0}% ของทั้งหมด`} tone="green" />
            <StatCard icon={<CircleAlert size={21} />} label="ไม่ผ่าน" value={counts.Failed} detail="ต้องตรวจสอบ" tone="red" />
            <StatCard icon={<Clock3 size={21} />} label="รอดำเนินการ" value={counts["Not Start"] + counts["In Progress"]} detail="ยังไม่สรุปผล" tone="amber" />
          </section>

          <section className="overview-grid">
            <article className="panel progress-panel"><div className="panel-heading"><div><h2>ความคืบหน้า</h2><p>สถานะรวมของ Testcase</p></div><button className="icon-button"><MoreHorizontal size={19} /></button></div><div className="progress-content"><div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><div><strong>{progress}%</strong><span>ดำเนินการแล้ว</span></div></div><div className="progress-legend">{TEST_STATUSES.filter((status) => status !== "In Progress").map((status) => <button key={status} onClick={() => setStatusFilter(status)}><span className={`legend-dot ${statusMeta[status].className}`} /><span>{statusMeta[status].label}</span><strong>{counts[status]}</strong></button>)}</div></div></article>
            <article className="panel activity-panel"><div className="panel-heading"><div><h2>กิจกรรมล่าสุด</h2><p>การเปลี่ยนแปลงจากข้อมูลจริง</p></div></div><div className="empty-state compact-empty"><Clock3 size={24} /><strong>ยังไม่มีกิจกรรม</strong><span>กิจกรรมจะแสดงเมื่อเชื่อมการบันทึกผลกับ Supabase</span></div></article>
          </section></>}

          {!testCaseId && activePage === "files" && source && <section className="panel workbook-panel">
            <div className="panel-heading"><div><h2>Sheets ในไฟล์ต้นฉบับ</h2><p>ระบบอ่านทุกแท็บและผูก RC / Defect ตาม Test Case ID</p></div><span className="sheet-total">{source.sheets.length || 1} sheets</span></div>
            {source.sheets.length ? <div className="sheet-grid">{source.sheets.map((sheet) => <div className={`sheet-card sheet-${sheet.kind}`} key={sheet.path}><FileSpreadsheet size={15} /><span><strong>{sheet.name}</strong><small>{sheet.kind === "result" ? `${sheet.testCaseIds.join(", ") || "Result"}${sheet.imageCount ? ` · ${sheet.imageCount} รูป` : ""}` : sheet.kind}</small></span></div>)}</div> : <div className="legacy-sheet-note">ไฟล์นี้ถูกอัปโหลดก่อนรองรับหลายชีต กรุณาอัปโหลดไฟล์ต้นฉบับอีกครั้ง</div>}
          </section>}

          {!testCaseId && activePage === "test-cases" && <section className="panel cases-panel" id="cases">
            <div className="cases-heading"><div><h2>Test cases</h2><span>{filteredCases.length} รายการ</span></div><div className="table-actions"><label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหา ID หรือชื่อ Testcase" /></label><label className="filter-select"><Filter size={16} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TestStatus | "All")}><option value="All">ทุกสถานะ</option>{TEST_STATUSES.map((status) => <option key={status} value={status}>{statusMeta[status].label}</option>)}</select><ChevronDown size={15} /></label></div></div>
            <div className="table-wrap"><table><thead><tr><th>TESTCASE</th><th>SCENARIO</th><th>PLATFORM</th><th>DEVICE</th><th>STATUS</th><th>ผู้ทดสอบ</th><th aria-label="การทำงาน" /></tr></thead><tbody>{filteredCases.map((item) => <tr key={item.id} onClick={() => router.push(`/groups/${groupId}/projects/${selectedProject.id}/test-cases/${encodeURIComponent(item.id)}`)}><td><span className="table-id">{item.id}</span><strong>{item.name || "ไม่มีชื่อ Testcase"}</strong></td><td><span className="truncate-cell">{item.scenario || "—"}</span></td><td><span className="platform-chip">{item.platform || "—"}</span></td><td>{item.device || "—"}</td><td><StatusBadge status={item.status} /></td><td><span className="tester"><span>{item.executedBy ? item.executedBy.slice(0, 2).toUpperCase() : "—"}</span>{item.executedBy || "ยังไม่มอบหมาย"}</span></td><td><button className="icon-button" onClick={(event) => { event.stopPropagation(); router.push(`/groups/${groupId}/projects/${selectedProject.id}/test-cases/${encodeURIComponent(item.id)}`); }} aria-label={`เปิด ${item.id}`}><ChevronRight size={18} /></button></td></tr>)}</tbody></table>{!filteredCases.length && <div className="empty-state">{cases.length ? <Search size={26} /> : <FileSpreadsheet size={26} />}<strong>{cases.length ? "ไม่พบ Testcase" : "ยังไม่มี Testcase"}</strong><span>{cases.length ? "ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ" : "ข้อมูลจะแสดงหลังจากอัปโหลดไฟล์ Excel"}</span>{!cases.length && <button className="secondary-button" onClick={() => setShowUpload(true)}><Upload size={16} />อัปโหลดไฟล์</button>}</div>}</div>
          </section>}

          {!testCaseId && activePage === "defects" && (allDefects.length ? <section className="panel cases-panel"><div className="cases-heading"><div><h2>Defects</h2><span>{allDefects.length} รายการ</span></div></div><div className="defect-list">{allDefects.map((defect) => <article key={defect.id}><div><span className="table-id">{defect.testCaseId}</span><strong>{defect.title}</strong><small>Defect ของ Test case</small></div><span className="status-badge status-failed">{defect.status}</span>{defect.description && <p>{defect.description}</p>}{defect.jiraUrl ? <a className="secondary-button" href={defect.jiraUrl} target="_blank" rel="noreferrer">เปิด Jira</a> : <span className="missing-jira">ยังไม่มี Jira URL</span>}</article>)}</div></section> : <section className="panel route-empty-state"><CircleAlert size={34} /><h2>ยังไม่มี Defect</h2><p>เปิด Test case แล้วกด Add Defect เพื่อบันทึกบั๊ก</p></section>)}

          {!testCaseId && activePage === "files" && !source && <section className="panel route-empty-state"><FileArchive size={34} /><h2>ยังไม่มีเอกสารหรือไฟล์ต้นฉบับ</h2><p>อัปโหลด Excel หรือเชื่อม Google Sheets เพื่อเริ่มต้น</p><button className="primary-button" onClick={() => setShowUpload(true)}><Upload size={16} />อัปโหลดไฟล์</button></section>}

          {!testCaseId && activePage === "settings" && <section className="settings-grid"><article className="panel settings-card"><h2>ข้อมูล Project</h2><dl><div><dt>ชื่อ Project</dt><dd>{selectedProject.name}</dd></div><div><dt>Environment</dt><dd>{selectedProject.environment}</dd></div><div><dt>Google Sheets</dt><dd>{selectedProject.googleSheetUrl || "ยังไม่ได้เชื่อม"}</dd></div></dl><button className="secondary-button" onClick={() => setShowGoogleSheetDialog(true)}><Link2 size={16} />ตั้งค่า Google Sheet</button></article><article className="panel settings-card danger-zone"><h2>ลบ Project</h2><p>ข้อมูล Test cases และไฟล์ต้นฉบับของ Project จะถูกลบทั้งหมด</p><button className="danger-button" onClick={() => void removeSelectedProject()}><Trash2 size={16} />ลบ Project</button></article></section>}
          </>}
        </div>
      </main>
      {showUpload && selectedProject && <UploadDialog onClose={() => setShowUpload(false)} onImported={async (nextCases, nextSource) => {
        const workspace = await persistImportedWorkbook(selectedProject.id, nextCases, nextSource, !selectedProject.googleSheetId);
        setCases(workspace.cases);
        setSource(workspace.source);
        setSearch("");
        setStatusFilter("All");
        setWorkspaceError("");
        flash(`บันทึก ${workspace.cases.length} Testcases ลง Supabase แล้ว`);
      }} />}
      {showProjectDialog && <ProjectDialog groupId={groupId} onClose={() => setShowProjectDialog(false)} onCreated={(project) => { setProjects((current) => [project, ...current]); setShowProjectDialog(false); router.push(`/groups/${groupId}/projects/${project.id}/overview`); }} />}
      {showGoogleSheetDialog && selectedProject && <GoogleSheetDialog project={selectedProject} onClose={() => setShowGoogleSheetDialog(false)} onConnected={(project) => { setProjects((current) => current.map((item) => item.id === project.id ? project : item)); setShowGoogleSheetDialog(false); flash("เชื่อม Google Sheet แล้ว"); }} />}
      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  );
}
