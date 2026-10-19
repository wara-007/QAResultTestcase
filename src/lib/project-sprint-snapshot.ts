import { parseStoredResults } from './stored-results';
import type { TestCase, TestStatus } from './types';
import type { SnapshotHeader } from './project-sprint-participation';

export type StoredCaseInput = {
  id:string; testcase_key:string; source_row?:number|null; case_name?:string;
  platform?:string; condition_text?:string; scenario?:string; steps?:string; expected_result?:string; test_data?:string;
  test_executions?:Array<{id?:string;attempt_no:number;status?:string;result_reference?:string;device?:string;app_version?:string;environment?:string;executed_by_name?:string;executed_date?:string;executed_time?:string;remark?:string}>|null;
};
export function snapshotCaseFromStored(row:StoredCaseInput):TestCase {
  const e=[...(row.test_executions ?? [])].sort((a,b)=>b.attempt_no-a.attempt_no)[0];
  const stored=parseStoredResults(e?.result_reference);
  return {id:row.testcase_key,recordId:row.id,executionId:e?.id,sourceRow:row.source_row ?? 0,
    platform:row.platform ?? '',condition:row.condition_text ?? '',scenario:row.scenario ?? '',name:row.case_name ?? '',steps:row.steps ?? '',expected:row.expected_result ?? '',testData:row.test_data ?? '',
    status:(e?.status ?? 'Not Start') as TestStatus,device:e?.device ?? '',appVersion:e?.app_version ?? '',environment:e?.environment ?? '',executedBy:e?.executed_by_name ?? '',executedDate:e?.executed_date ?? '',executedTime:e?.executed_time ?? '',remark:e?.remark ?? '',evidence:[],...stored};
}
export function validateSnapshotHeader(value:unknown):SnapshotHeader {
  const h=value as SnapshotHeader;
  if(!h || h.version!==1 || !h.project?.id || !h.participation?.id || !h.counts || !Array.isArray(h.qa) || !h.approval || !['full','legacy-summary'].includes(h.participation.snapshotKind)) throw new Error('ข้อมูลย้อนหลังไม่รองรับหรือไม่สมบูรณ์');
  return h;
}
