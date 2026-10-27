import {safeReferenceUrl,isExternalReferenceText,isIssueReference,readResultReferenceLinks,type ResultReferenceLink} from "./result-reference-links";
import { assignRegisterCaseIdentities } from "./register-case-identity";
import { stepColumnName, stepHeaderKey } from "./step-testcases";
import type { TestCase } from "./types";
import { caseResultReferences, referenceKey, referencedSheetCaseIds, matchingResultSheetName } from "./sheet-mapping-model";

const missingReferencePrefix = "Ref (Result Testing): ไม่พบแท็บที่อ้างอิง ";
export const isMissingResultReferenceIssue = (issue: string) => issue.startsWith(missingReferencePrefix);

/** Keep the complete register even when a referenced result tab is absent. */
export function withResultReferenceIssues(cases: readonly TestCase[], sheets: readonly { name: string }[]): TestCase[] {
  const names = new Set(sheets.map(sheet => referenceKey(sheet.name)));
  return cases.map(testCase => {
    const missing = [...new Set(caseResultReferences(testCase))].filter(ref => !names.has(referenceKey(ref)));
    return { ...testCase, importIssues: [...new Set([
      ...(testCase.importIssues ?? []).filter(issue => !isMissingResultReferenceIssue(issue)),
      ...missing.map(ref => `${missingReferencePrefix}"${ref.trim()}"`),
    ])] };
  });
}

/** Read referenced evidence first; retain other real tabs for inspection. */
export function prioritizeReferencedSheets<T extends { name: string }>(sheets: readonly T[], cases: readonly TestCase[]): T[] {
  const order = new Map(cases.map((testCase, index) => [testCase.id, index]));
  const rank = (sheet: T) => Math.min(...referencedSheetCaseIds(sheet.name, cases).map(id => order.get(id) ?? Infinity), Infinity);
  return [...sheets].sort((left, right) => rank(left) - rank(right));
}

/** Resolve Ref destinations, not arbitrary links in other register columns. */
export function resolveRegisterReferenceTargets(cases: readonly TestCase[], sheets: readonly { name: string; sheetId?: number }[], links: ReadonlyMap<string, string> = new Map(), spreadsheetId?: string): TestCase[] {
  const targetName = (link: string): string | undefined => {
    const local = link.replace(/^#/, '').match(/^(?:'((?:[^']|'')+)'|([^!]+))![A-Z]+\d+(?::[A-Z]+\d+)?$/i);
    if (local) {
      const name = (local[1]?.replaceAll("''", "'") ?? local[2]).trim();
      return sheets.find(sheet => sheet.name === name)?.name;
    }
    let gid: string | null = null;
    if (/^#gid=\d+(?:&|$)/.test(link)) gid = new URLSearchParams(link.slice(1)).get('gid');
    else {
      try {
        const url = new URL(link);
        const fileId = url.pathname.match(/^\/spreadsheets\/d\/([^/]+)/)?.[1];
        if (url.hostname !== 'docs.google.com' || !spreadsheetId || fileId !== spreadsheetId) return;
        gid = new URLSearchParams(url.hash.slice(1)).get('gid') ?? url.searchParams.get('gid');
      } catch { return; }
    }
    return gid && /^\d+$/.test(gid) ? sheets.find(sheet => sheet.sheetId === Number(gid))?.name : undefined;
  };
  return assignRegisterCaseIdentities(cases).map(testCase => {
    const references = [
      ...(testCase.sourceFields ?? []).filter(field => field.field === 'resultReference' || ['refresulttesting', 'resultreference'].includes(stepHeaderKey(field.label))).map(field => ({ ref: `${stepColumnName(field.column)}${testCase.sourceRow}`, value: field.value })),
      ...(testCase.stepDefinitions ?? []).flatMap(step => (step.sourceFields ?? []).filter(field => ['refresulttesting','resultreference'].includes(stepHeaderKey(field.label))).map(field => ({ ref: field.ref, value: field.value }))),
    ];
    const resolvedLinks:ResultReferenceLink[]=[];
    const inputs=references.length?references:[{ref:'',value:testCase.resultReference}];
    const targets=inputs.flatMap(field=>{
      const rawLink=links.get(field.ref);
      const link=safeReferenceUrl(rawLink) ?? safeReferenceUrl(field.value);
      const localTarget=rawLink?targetName(rawLink):targetName(field.value);
      if(localTarget)return [localTarget];
      if(link)resolvedLinks.push({label:field.value.trim()||link,url:link});
      // A Jira ticket can accompany a local result tab with the same label.
      const named=(!link||isIssueReference(link))?matchingResultSheetName(field.value.trim(),sheets.map(sheet=>sheet.name)):undefined;
      if(named)return [named];
      if(link || isExternalReferenceText(field.value))return [];
      return field.value.trim()?[field.value.trim()]:[];
    });
    return { ...testCase, resultReferenceTargets: [...new Set(targets)], resultReferenceLinks:readResultReferenceLinks(resolvedLinks) };
  });
}

/** Legacy previews are fallback owners only when no registered Ref owns a tab. */
export function unreferencedSnapshotAssignments(cases: readonly TestCase[]): Map<string, string> {
  const assignments = new Map<string, string>();
  for (const testCase of cases) {
    if (!testCase.sourceSheetName || referencedSheetCaseIds(testCase.sourceSheetName, cases).length) continue;
    const key = testCase.sourceSheetName.trim().toLocaleLowerCase();
    if (!assignments.has(key)) assignments.set(key, testCase.id);
  }
  return assignments;
}
