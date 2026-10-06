export type CanonicalResult = { id: string; stepId?: string; status: string; actualResult: string; apiResponse: string; log: string; createdAt: string; customFields: Record<string, string> };
export type CanonicalDefect = { id: string; title: string; description: string; status: string; jiraUrl: string; apiResponse: string; log: string; createdAt: string };
export type CanonicalTestCase = {
  id: string; platform: string; condition: string; scenario: string; name: string; steps: string; expected: string;
  status: string; device: string; testData: string; appVersion: string; environment: string; executedBy: string;
  executedDate: string; executedTime: string; remark: string; customFields: Record<string, string>;
  results: Record<string, CanonicalResult>; defects: Record<string, CanonicalDefect>;
  stepDefinitions?: Record<string, import("../types").TestCaseStep>;
};
export type CanonicalProjectSnapshot = { cases: Record<string, CanonicalTestCase> };
