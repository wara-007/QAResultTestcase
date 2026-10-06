import React from "react";
import { TEST_STATUSES, type TestCase, type TestCaseStep, type TestResult } from "../lib/types";
import { aggregateStepStatus, stepHeaderColumns } from "../lib/step-testcases";
import { splitHighlightedText } from "../lib/result-preview";
const sourceLabel = (step: TestCaseStep, field: keyof NonNullable<ReturnType<typeof stepHeaderColumns>>, fallback: string) => {
  const column = stepHeaderColumns((step.sourceFields ?? []).map(item => item.label))?.[field];
  return column !== undefined && column >= 0 ? step.sourceFields?.[column]?.label || fallback : fallback;
};

export function stepResultTitle(testCase: TestCase, result: Pick<TestResult, "stepId">) {
  const step = testCase.stepDefinitions?.find(step => step.id === result.stepId);
  return step ? `${step.name} · ${step.description}` : "ผลที่ยังไม่ผูก Step";
}
export function orderedStepResults(testCase: TestCase) {
  const steps = testCase.stepDefinitions ?? [];
  if (!steps.length) return testCase.results ?? [];
  const ids = new Set(steps.map(step => step.id));
  return [...steps.flatMap(step => (testCase.results ?? []).filter(result => result.stepId === step.id)), ...(testCase.results ?? []).filter(result => !result.stepId || !ids.has(result.stepId))];
}
export function TestCaseSteps({ testCase, readOnly, onChange, renderResults, onAddResult }: { testCase: TestCase; readOnly: boolean; onChange?: (testCase: TestCase) => void; renderResults?: (results: TestResult[]) => React.ReactNode; onAddResult?: (stepId: string) => void }) {
  if (!testCase.stepDefinitions?.length) return null;
  const change = (id: string, field: keyof TestCaseStep, value: string) => {
    const stepDefinitions = testCase.stepDefinitions!.map(step => step.id === id ? { ...step, [field]: value, ...(field === "status" ? { rawStatus: value } : {}) } : step);
    onChange?.({ ...testCase, stepDefinitions, status: aggregateStepStatus(stepDefinitions), steps: stepDefinitions.map(step => `${step.name}\n${step.description}`).join("\n\n"), expected: stepDefinitions.map(step => `${step.name}\n${step.expected}`).join("\n\n") });
  };
  return <section className="test-case-steps"><div className="result-sheet-heading"><span>ขั้นตอนการทดสอบ</span><strong>{testCase.stepDefinitions.length} Steps</strong></div>
    {!readOnly && <p className="muted">คำอธิบายและ Expected Result อ่านจาก Sheets โดยตรง แก้สถานะและข้อมูลการทดสอบแต่ละ Step ได้ด้านล่าง แล้วกดบันทึกผล</p>}
    {testCase.stepDefinitions.map((step, index) => <details className="test-case-step" key={step.id} open={index === 0}><summary><strong>{index + 1}. {step.name}</strong><span>{step.status === "Unknown" ? step.rawStatus : step.status} · {(testCase.results ?? []).filter(result => result.stepId === step.id).length} Results</span></summary><div className="test-case-step-body">
      <div className="two-column-fields">{(["description", "expected"] as const).map(field => <label className="text-field" key={field}><span>{sourceLabel(step, field, field === "description" ? "Description Step" : "Expected Result")}</span><div className="multiline">{step[field] || "—"}</div></label>)}</div>
      <div className="two-column-fields">{(["device", "environment", "appVersion", "executedBy", "executedDate"] as const).map(field => <label key={field}><span>{sourceLabel(step, field, { device: "Device", environment: "Environment", appVersion: "App version", executedBy: "ผู้ทดสอบ", executedDate: "Executed Date" }[field])}</span>{readOnly ? <div>{step[field] || "—"}</div> : <input value={step[field]} onChange={event => change(step.id, field, event.target.value)} />}</label>)}</div>
      {!readOnly && <label><span>สถานะ Step</span><select value={step.status} onChange={event => change(step.id, "status", event.target.value)}>{[...TEST_STATUSES, "Blocked", "Unknown"].map(status => <option key={status}>{status}</option>)}</select></label>}
      <div className="two-column-fields">{(["classification", "resultReference", "remark"] as const).filter(field => step[field]).map(field => <label key={field}><span>{sourceLabel(step, field, { classification: "Positive/Negative Case", resultReference: "Ref (Result Testing)", remark: "REMARK" }[field])}</span><div className="multiline">{step[field]}</div></label>)}</div>
      {!!step.sourceFields?.some(field => !field.mapped && field.value.trim()) && <dl className="sheet-result-fields">{step.sourceFields.filter(field => !field.mapped && field.value.trim()).map(field => <div key={field.ref}><dt>{field.label}</dt><dd className="multiline">{splitHighlightedText(field.value, field.highlights).map((part, index) => <span key={index} style={{ color: part.color, backgroundColor: part.background, fontWeight: part.bold ? 700 : undefined }}>{part.text}</span>)}</dd></div>)}</dl>}
      {renderResults?.((testCase.results ?? []).filter(result => result.stepId === step.id))}
      {!readOnly && onAddResult && <button type="button" className="secondary-button" onClick={() => onAddResult(step.id)}>เพิ่ม Result ให้ {step.name}</button>}
    </div></details>)}
    {!!testCase.importIssues?.length && <div className="form-error"><ul>{testCase.importIssues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></div>}
  </section>;
}
