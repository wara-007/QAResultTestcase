"use client";

import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, ExternalLink, FileSpreadsheet, LoaderCircle, RotateCcw, ShieldCheck, X, ZoomIn } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ProjectReview } from "@/lib/project-review";
import type { TestEvidence, TestStatus } from "@/lib/types";
import { evidenceImageUrl } from "@/lib/evidence";

const statusClass: Record<TestStatus, string> = {
  "Not Start": "status-not-start",
  "In Progress": "status-in-progress",
  Pass: "status-pass",
  Failed: "status-failed",
  Skip: "status-skip",
};

function EvidenceGallery({ evidence, evidenceBasePath }: { evidence: TestEvidence[]; evidenceBasePath: string }) {
  const [preview, setPreview] = useState<TestEvidence | null>(null);

  useEffect(() => {
    if (!preview) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setPreview(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [preview]);

  if (!evidence.length) return null;
  const previewUrl = preview ? evidenceImageUrl(preview, evidenceBasePath) : "";
  return <><div className="review-evidence">{evidence.map((item) => {
    const url = evidenceImageUrl(item, evidenceBasePath);
    return item.mimeType.startsWith("image/") ? <button type="button" key={`${item.fileId}-${item.name}`} onClick={() => setPreview(item)} aria-label={`ดูรูป ${item.name}`}>
      <Image src={url} alt={item.name} width={360} height={220} sizes="(max-width: 600px) 50vw, 220px" unoptimized />
      <span className="review-evidence-overlay"><ZoomIn size={18} />ดูรูป</span>
    </button> : <a key={`${item.fileId}-${item.name}`} href={url} target="_blank" rel="noreferrer"><span>{item.name}<ExternalLink size={14} /></span></a>;
  })}</div>
  {preview && <div className="review-image-backdrop" role="presentation" onMouseDown={() => setPreview(null)}>
    <section className="review-image-dialog" role="dialog" aria-modal="true" aria-label={`ตัวอย่างรูป ${preview.name}`} onMouseDown={(event) => event.stopPropagation()}>
      <header><strong>{preview.name}</strong><button type="button" onClick={() => setPreview(null)} aria-label="ปิดตัวอย่างรูป"><X size={21} /></button></header>
      <div className="review-image-stage"><Image src={previewUrl} alt={preview.name} fill sizes="95vw" unoptimized /></div>
    </section>
  </div>}
  </>;
}

function TextBlock({ label, value, code = false }: { label: string; value: string; code?: boolean }) {
  if (!value) return null;
  return <div className="review-text-block"><strong>{label}</strong>{code ? <pre>{value}</pre> : <p>{value}</p>}</div>;
}

export function ReviewWorkspace({ token, requestId, currentUserName = "" }: { token?: string; requestId?: string; currentUserName?: string }) {
  const apiPath = requestId ? `/api/approvals/${encodeURIComponent(requestId)}` : `/api/reviews/${encodeURIComponent(token ?? "")}`;
  const evidenceBasePath = `${apiPath}/evidence`;
  const [review, setReview] = useState<ProjectReview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewerName, setReviewerName] = useState(currentUserName);
  const [comment, setComment] = useState("");
  const [decision, setDecision] = useState<"approved" | "changes_requested" | null>(null);
  const [casePage, setCasePage] = useState(1);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(apiPath, { cache: "no-store" });
      const payload = await response.json() as { review?: ProjectReview; error?: string };
      if (!response.ok || !payload.review) throw new Error(payload.error || "โหลดข้อมูลรีวิวไม่สำเร็จ");
      setReview(payload.review);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "โหลดข้อมูลรีวิวไม่สำเร็จ");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch(apiPath, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { review?: ProjectReview; error?: string };
        if (!response.ok || !payload.review) throw new Error(payload.error || "โหลดข้อมูลรีวิวไม่สำเร็จ");
        setReview(payload.review);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "โหลดข้อมูลรีวิวไม่สำเร็จ");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [apiPath]);

  const counts = useMemo(() => {
    const initial: Record<TestStatus, number> = { "Not Start": 0, "In Progress": 0, Pass: 0, Failed: 0, Skip: 0 };
    for (const testCase of review?.cases ?? []) initial[testCase.status] += 1;
    return initial;
  }, [review]);

  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil((review?.cases.length ?? 0) / pageSize));
  const currentPage = Math.min(casePage, pageCount);
  const visibleCases = review?.cases.slice((currentPage - 1) * pageSize, currentPage * pageSize) ?? [];
  const pageNumbers = pageCount <= 7
    ? Array.from({ length: pageCount }, (_, index) => index + 1)
    : [...new Set([1, currentPage - 1, currentPage, currentPage + 1, pageCount])].filter((page) => page >= 1 && page <= pageCount).sort((a, b) => a - b);

  function changePage(page: number) {
    setCasePage(Math.max(1, Math.min(page, pageCount)));
    document.querySelector(".review-cases-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(nextDecision: "approved" | "changes_requested") {
    if (!reviewerName.trim()) return setError("กรุณาระบุชื่อผู้รีวิว");
    if (nextDecision === "changes_requested" && !comment.trim()) return setError("กรุณาระบุสิ่งที่ต้องการให้แก้ไข");
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(apiPath, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: nextDecision, reviewerName, comment }),
      });
      const payload = await response.json() as { approval?: { status: "approved" | "changes_requested"; reviewedAt: string; reviewerName: string; reviewerComment: string }; error?: string };
      if (!response.ok || !payload.approval) throw new Error(payload.error || "บันทึกผลรีวิวไม่สำเร็จ");
      setDecision(null);
      setReview((current) => current ? { ...current, request: { ...current.request, ...payload.approval } } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึกผลรีวิวไม่สำเร็จ");
    } finally { setSubmitting(false); }
  }

  if (loading) return <main className="review-state"><LoaderCircle className="spin" size={34} /><h1>กำลังโหลดผลการทดสอบ</h1></main>;
  if (!review) return <main className="review-state error"><AlertTriangle size={38} /><h1>เปิดหน้ารีวิวไม่ได้</h1><p>{error}</p><button className="secondary-button" onClick={load}><RotateCcw size={16} />ลองใหม่</button></main>;

  const answered = review.request.status === "approved" || review.request.status === "changes_requested";
  return <div className="review-page">
    <header className="review-topbar"><div><span><ClipboardCheck size={21} /></span><div><strong>QA Result Workspace</strong><small>PO Review</small></div></div>{requestId ? <Link className="review-back-inbox" href="/approvals">กลับไปรายการทั้งหมด</Link> : <div className="review-secure"><ShieldCheck size={16} />ลิงก์รีวิวเฉพาะคำขอ</div>}</header>
    <main className="review-container">
      <section className="review-hero">
        <p className="eyebrow">PROJECT APPROVAL</p><h1>{review.project.name}</h1><p>{review.project.description || "ตรวจสอบ Test Case และผลการทดสอบทั้งหมดก่อนอนุมัติ"}</p>
        <div className="review-project-meta"><span>{review.project.environment || "ไม่ระบุ Environment"}</span>{review.project.sprintNo && <span>{review.project.sprintNo}</span>}<span>ส่งโดย {review.request.requestedByName || "QA Team"}</span></div>
        {review.project.googleSheetUrl && <a className="review-sheet-link" href={review.project.googleSheetUrl} target="_blank" rel="noreferrer"><FileSpreadsheet size={17} />เปิด Google Sheets<ExternalLink size={14} /></a>}
      </section>

      <section className="review-summary">
        <article><span>ทั้งหมด</span><strong>{review.cases.length}</strong></article><article className="pass"><span>Pass</span><strong>{counts.Pass}</strong></article><article className="failed"><span>Failed</span><strong>{counts.Failed}</strong></article><article><span>Inprogress</span><strong>{counts["In Progress"]}</strong></article><article><span>Not Start</span><strong>{counts["Not Start"]}</strong></article><article><span>Skip</span><strong>{counts.Skip}</strong></article>
      </section>

      <section className="review-cases-section"><div className="review-section-heading"><div><h2>Test Cases และ Results</h2><p>กดแต่ละรายการเพื่อดูรายละเอียด ผลทดสอบ รูปหลักฐาน และ Defect</p></div><span>{review.cases.length} cases</span></div>
        <div className="review-case-list">{visibleCases.map((testCase, index) => <details className="review-case" key={`${currentPage}-${testCase.recordId}-${testCase.id}`} open={index === 0}>
          <summary><div><span className="review-case-number">{String((currentPage - 1) * pageSize + index + 1).padStart(2, "0")}</span><div><strong>{testCase.id} · {testCase.name || "ไม่มีชื่อ Test Case"}</strong><small>{testCase.scenario || "ไม่ระบุ Scenario"}</small></div></div><div><span className={`status-badge ${statusClass[testCase.status]}`}><span />{testCase.status}</span><ChevronDown size={19} /></div></summary>
          <div className="review-case-content">
            <div className="review-case-grid"><TextBlock label="Test Scenario" value={testCase.scenario} /><TextBlock label="Platform" value={testCase.platform} /><TextBlock label="Test Step Description" value={testCase.steps} /><TextBlock label="Expected Result" value={testCase.expected} /><TextBlock label="Test Data" value={testCase.testData} /><TextBlock label="หมายเหตุ" value={testCase.remark} /></div>
            <div className="review-execution-meta"><span>Device: <strong>{testCase.device || "-"}</strong></span><span>App version: <strong>{testCase.appVersion || "-"}</strong></span><span>ผู้ทดสอบ: <strong>{testCase.executedBy || "-"}</strong></span><span>เวลา: <strong>{[testCase.executedDate, testCase.executedTime].filter(Boolean).join(" ") || "-"}</strong></span></div>
            <div className="review-results"><h3>Results <span>{testCase.results?.length ?? 0}</span></h3>{testCase.results?.length ? testCase.results.map((result, resultIndex) => <article key={result.id}><header><strong>Result {resultIndex + 1}</strong><span className={`status-badge ${statusClass[result.status]}`}><span />{result.status}</span></header><TextBlock label="Actual Result" value={result.actualResult} /><TextBlock label="API Response" value={result.apiResponse} code /><TextBlock label="Log" value={result.log} code /><EvidenceGallery evidence={result.evidence ?? []} evidenceBasePath={evidenceBasePath} /></article>) : <p className="review-empty">ยังไม่มี Result</p>}</div>
            {!!testCase.defects?.length && <div className="review-defects"><h3>Defects <span>{testCase.defects.length}</span></h3>{testCase.defects.map((defect) => <article key={defect.id}><header><strong>{defect.title || defect.id}</strong><span>{defect.status}</span></header><TextBlock label="รายละเอียด" value={defect.description} />{defect.jiraUrl && <a href={defect.jiraUrl} target="_blank" rel="noreferrer">เปิด Jira Card <ExternalLink size={14} /></a>}<TextBlock label="API Response" value={defect.apiResponse} code /><TextBlock label="Log" value={defect.log} code /><EvidenceGallery evidence={defect.evidence ?? []} evidenceBasePath={evidenceBasePath} /></article>)}</div>}
          </div>
        </details>)}</div>
        {pageCount > 1 && <nav className="review-pagination" aria-label="หน้า Test Cases"><span>แสดง {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, review.cases.length)} จาก {review.cases.length}</span><div><button type="button" onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1} aria-label="หน้าก่อนหน้า"><ChevronLeft size={17} /></button>{pageNumbers.map((page, index) => <span key={page}>{index > 0 && page - pageNumbers[index - 1] > 1 && <i>…</i>}<button type="button" className={page === currentPage ? "active" : ""} onClick={() => changePage(page)} aria-current={page === currentPage ? "page" : undefined}>{page}</button></span>)}<button type="button" onClick={() => changePage(currentPage + 1)} disabled={currentPage === pageCount} aria-label="หน้าถัดไป"><ChevronRight size={17} /></button></div></nav>}
      </section>

      <section className={`review-decision ${answered ? review.request.status : ""}`}>
        {answered ? <><div className="review-decision-result">{review.request.status === "approved" ? <CheckCircle2 size={31} /> : <AlertTriangle size={31} />}<div><h2>{review.request.status === "approved" ? "Approved แล้ว" : "ส่งกลับให้แก้ไขแล้ว"}</h2><p>โดย {review.request.reviewerName}{review.request.reviewedAt ? ` · ${new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(review.request.reviewedAt))}` : ""}</p></div></div>{review.request.reviewerComment && <div className="review-comment"><strong>ความคิดเห็น</strong><p>{review.request.reviewerComment}</p></div>}</> : <><div><h2>ผลการรีวิวของ PO</h2><p>กรุณาตรวจสอบข้อมูลด้านบนก่อนยืนยัน ผลการรีวิวจะถูกส่งกลับไปแสดงในหน้า Project ของ QA</p></div>{currentUserName ? <div className="review-signed-reviewer"><span>ผู้รีวิว</span><strong>{currentUserName}</strong></div> : <label className="text-field"><span>ชื่อผู้รีวิว *</span><input value={reviewerName} onChange={(event) => setReviewerName(event.target.value)} placeholder="ชื่อ-นามสกุล" maxLength={160} /></label>}<label className="text-field"><span>ความคิดเห็น / รายการที่ต้องแก้ไข</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} maxLength={5000} placeholder="ไม่บังคับสำหรับ Approved" /></label>{error && <p className="form-error"><AlertTriangle size={16} />{error}</p>}<div className="review-actions"><button className="secondary-button danger-soft" disabled={submitting} onClick={() => setDecision("changes_requested")}>ขอให้แก้ไข</button><button className="primary-button approve-button" disabled={submitting} onClick={() => setDecision("approved")}><CheckCircle2 size={17} />Approved</button></div></>}
      </section>
    </main>
    {decision && <div className="modal-backdrop" role="presentation" onMouseDown={() => setDecision(null)}><section className="review-confirm" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className={decision === "approved" ? "approve" : "changes"}>{decision === "approved" ? <CheckCircle2 size={28} /> : <AlertTriangle size={28} />}</div><h2>{decision === "approved" ? "ยืนยันการ Approved?" : "ยืนยันส่งกลับให้แก้ไข?"}</h2><p>เมื่อยืนยันแล้วจะไม่สามารถเปลี่ยนผลผ่านลิงก์นี้ได้</p><div className="dialog-actions"><button className="secondary-button" disabled={submitting} onClick={() => setDecision(null)}>ยกเลิก</button><button className={decision === "approved" ? "primary-button approve-button" : "primary-button"} disabled={submitting} onClick={() => void submit(decision)}>{submitting && <LoaderCircle className="spin" size={16} />}ยืนยัน</button></div></section></div>}
  </div>;
}
