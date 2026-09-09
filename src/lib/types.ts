export const TEST_STATUSES = ["Not Start", "Pass", "In Progress", "Failed", "Skip"] as const;

export type TestStatus = (typeof TEST_STATUSES)[number];

export type TestEvidence = {
  fileId: string;
  name: string;
  mimeType: string;
};

export type TestDefect = {
  id: string;
  title: string;
  description: string;
  status: string;
  jiraUrl: string;
  apiResponse: string;
  log: string;
  evidence: TestEvidence[];
  createdAt: string;
};

export type TestResult = {
  id: string;
  status: TestStatus;
  actualResult: string;
  apiResponse: string;
  log: string;
  evidence: TestEvidence[];
  /** @deprecated Defects now belong to the TestCase. Kept for old saved payloads. */
  defects?: TestDefect[];
  createdAt: string;
};

export type TestCase = {
  id: string;
  recordId?: string;
  executionId?: string;
  persistedLocally?: boolean;
  sourceRow: number;
  platform: string;
  condition: string;
  scenario: string;
  name: string;
  steps: string;
  expected: string;
  status: TestStatus;
  device: string;
  testData: string;
  appVersion: string;
  environment: string;
  resultReference: string;
  executedBy: string;
  executedDate: string;
  executedTime: string;
  remark: string;
  evidence: TestEvidence[];
  results?: TestResult[];
  defects?: TestDefect[];
};

export type WorkbookSource = {
  id?: string;
  fileName: string;
  buffer: ArrayBuffer;
  sheetName: string;
  sheetPath: string;
  columns: Record<string, string>;
  sheets: WorkbookSheet[];
};

export type WorkbookSheetKind = "testcase" | "result" | "defect" | "summary" | "data" | "other";

export type WorkbookSheet = {
  name: string;
  path: string;
  order: number;
  kind: WorkbookSheetKind;
  testCaseIds: string[];
  imageCount: number;
  hidden: boolean;
};

export type WorkbookSheetContent = {
  cells: Array<{ ref: string; value: string }>;
  truncatedCellCount: number;
  images: Array<{ name: string; mimeType: string; bytes: Uint8Array }>;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  sprintNo: string;
  environment: string;
  googleSheetId: string;
  googleSheetUrl: string;
  createdAt: string;
};

export type Group = {
  id: string;
  name: string;
  description: string;
  projectCount: number;
  createdAt: string;
  canAccess: boolean;
  canManage: boolean;
};

export type GroupMember = {
  memberId: string;
  email: string;
  displayName: string;
  role: "admin" | "qa_lead" | "qa" | "viewer";
  pending: boolean;
  isOwner: boolean;
};

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  isSystemOwner?: boolean;
};

export type SystemUser = {
  id: string;
  email: string;
  displayName: string;
  isSystemOwner: boolean;
  lastSignInAt: string | null;
};
