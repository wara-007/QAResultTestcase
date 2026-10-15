"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import type { TestCase, TestResult, WorkbookSheet } from "../lib/types";
import { TestCaseSourceDetails } from "./test-case-source-details";
import { TestCaseSteps, orderedStepResults, stepResultTitle } from "./test-case-steps";
import { ReviewResultContent } from "./review-workspace";
import { SharedSheetDefinition } from "./shared-sheet-definition";
import { formatFlexibleDate } from "../lib/date-format";
import { ImageViewerGallery } from "./image-viewer-gallery";
import { evidenceImageUrl } from "../lib/evidence";

export function TestCasePreview({ testCase, projectId, backHref, editHref, sourceSheetName = "", loading = false, associatedSheets = [], onBack }: {
  testCase: TestCase; projectId: string; backHref: string; editHref?: string;
  sourceSheetName?: string; loading?: boolean; associatedSheets?: WorkbookSheet[]; onBack?: () => void;
}) {
  const evidenceBasePath = `/api/projects/${projectId}/evidence`;
  const results = orderedStepResults(testCase).filter(result => !sourceSheetName || !result.sourceSheetName || result.sourceSheetName === sourceSheetName);
  const defects = (testCase.defects ?? []).filter(defect => !sourceSheetName || !defect.sourceSheetName || defect.sourceSheetName === sourceSheetName);
  const usedEvidence = new Set([...results, ...defects].flatMap(result => result.evidence.map(item => item.fileId)));
  const extraEvidence = testCase.evidence.filter(item => !usedEvidence.has(item.fileId));
  const renderResult = (result: TestResult, index: number) => <details key={`${result.id}:${result.sourceSheetName ?? ""}`} className="testcase-preview-result" open={index === 0}>
    <summary><strong>{testCase.stepDefinitions?.length || result.sharedSheetMappingVersion ? stepResultTitle(testCase, result) : `ผลที่ ${index + 1}`}</strong><span>{result.status}</span></summary>
    <div className="testcase-preview-result-body"><div className="testcase-preview-result-meta">{result.sourceSheetName && <span>จากแท็บ {result.sourceSheetName}</span>}{result.testerName && <span>ผู้ทดสอบ: {result.testerName}</span>}{result.createdAt && <time>{formatFlexibleDate(result.createdAt)}</time>}</div><ReviewResultContent result={result} evidenceBasePath={evidenceBasePath} /></div>
  </details>;
  return <section className="panel testcase-preview-page" aria-label={`Preview ${testCase.id}`}>
    <header className="testcase-preview-header"><div><span className="eyebrow">TEST CASE PREVIEW · ดูอย่างเดียว</span><h2>{testCase.id} · {testCase.name}</h2>{sourceSheetName && <p>แท็บต้นทาง: {sourceSheetName}</p>}</div><div className="testcase-preview-actions">{onBack ? <button type="button" className="secondary-button" onClick={onBack}><ArrowLeft size={16} />กลับ Test cases</button> : <Link href={backHref} className="secondary-button"><ArrowLeft size={16} />กลับ Test cases</Link>}{editHref && <Link href={editHref} className="primary-button"><Pencil size={16} />แก้ไข Test Case</Link>}</div></header>
    <div className="testcase-preview-body">
      <dl className="testcase-preview-metadata">{[["สถานะ", testCase.status], ["Platform", testCase.platform], ["Environment", testCase.environment], ["Device", testCase.device], ["App version", testCase.appVersion], ["ผู้ทดสอบ", testCase.executedBy], ["Test data", testCase.testData]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <TestCaseSourceDetails testCase={testCase} />
      {associatedSheets.filter(sheet => sheet.testCaseIds.length > 1 && (!sourceSheetName || sheet.name === sourceSheetName)).map(sheet => <SharedSheetDefinition key={sheet.path} caseId={testCase.id} sheetName={sheet.name} caseIds={sheet.testCaseIds} table={results.find(result => result.sourceSheetName === sheet.name && result.sheetDefinitionTable)?.sheetDefinitionTable} />)}
      <TestCaseSteps testCase={testCase} readOnly expandAll />
      <section aria-label="Results"><div className="result-sheet-heading"><h3>Results</h3><strong>{results.length} รายการ</strong></div>
        {results.map(renderResult)}
        {loading && <div className="sheet-text-shimmer" role="status" aria-label="กำลังโหลดรายละเอียด"><span/><span/><span/></div>}
        {!loading && !results.length && <p className="muted">ยังไม่มี Result ที่บันทึกไว้</p>}
      </section>
      {!!extraEvidence.length && <section><h3>หลักฐานเพิ่มเติม</h3><ImageViewerGallery images={extraEvidence.filter(item => /^(image|video)\//.test(item.mimeType)).map(item => ({ id: item.fileId, name: item.name, mimeType: item.mimeType, url: evidenceImageUrl(item, evidenceBasePath) }))} />{extraEvidence.filter(item => !/^(image|video)\//.test(item.mimeType)).map(item => <a key={item.fileId} href={evidenceImageUrl(item, evidenceBasePath)} target="_blank" rel="noopener noreferrer">{item.name}<ExternalLink size={14}/></a>)}</section>}
      <section aria-label="Defects"><div className="result-sheet-heading"><h3>Defects</h3><strong>{defects.length} รายการ</strong></div>{defects.map(defect => <article key={defect.id} className="testcase-preview-defect"><header><h4>{defect.id} · {defect.title}</h4><span className="status-badge status-failed">{defect.status}</span></header><ReviewResultContent result={{ ...defect, status: "Failed", actualResult: defect.description }} evidenceBasePath={evidenceBasePath}/>{defect.jiraUrl && <a className="secondary-button" href={defect.jiraUrl} target="_blank" rel="noopener noreferrer">เปิด Jira<ExternalLink size={14}/></a>}</article>)}{!defects.length && <p className="muted">ไม่มี Defect ที่บันทึกไว้</p>}</section>
    </div>
  </section>;
}
