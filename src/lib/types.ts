export const TEST_STATUSES = ["Not Start", "Pass", "In Progress", "Failed", "Skip"] as const;

export type TestStatus = (typeof TEST_STATUSES)[number];

export type TestEvidence = {
  fileId: string;
  name: string;
  mimeType: string;
  provider?: "google-drive" | "cloudflare-r2" | "external-url";
  objectKey?: string;
  url?: string;
  uploadedBy?: string;
};

export type TestDefect = {
  platform?: string;
  appVersion?: string;
  reporter?: string;
  testCaseReference?: string;
  rcReference?: string;
  id: string;
  title: string;
  description: string;
  status: string;
  jiraUrl: string;
  apiResponse: string;
  log: string;
  evidence: TestEvidence[];
  createdAt: string;
  sourceSheetName?: string;
};

export type TestResult = {
  sheetDisplay?: import("./sheet-sections").SheetDisplaySettings;
  sheetSections?: import("./sheet-sections").SheetSection[];
  textHighlights?: Partial<Record<"actualResult" | "apiResponse" | "log", import("./result-preview").TextHighlight[]>>;
  id: string;
  testerName?: string;
  source?: 'web' | 'sheets';
  status: TestStatus;
  actualResult: string;
  apiResponse: string;
  log: string;
  evidence: TestEvidence[];
  customFields?: TestCaseResultField[];
  /** @deprecated Defects now belong to the TestCase. Kept for old saved payloads. */
  defects?: TestDefect[];
  createdAt: string;
  sourceSheetName?: string;
  origin?: ResultOrigin;
};

export type ResultOrigin = { sprintId: string; sprintName: string; year: number; authorId: string | null; authorName: string; inferred: boolean; recordedAt: string };
export type PlanningTeamMember = { userId: string; name: string; email: string; role: string };

export type TestCaseResultField = {
  key: string;
  label: string;
  value: string;
  column: number;
};

export type TestCaseCustomField = {
  key: string;
  label: string;
  value: string;
  source: "testcase" | "detail";
  sheetName: string;
  row: number;
  column: number;
};

export type TestCase = {
  id: string;
  sourceSheetName?: string;
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
  customFields?: TestCaseCustomField[];
  resultFieldDefinitions?: TestCaseResultField[];
  results?: TestResult[];
  defects?: TestDefect[];
};

export type WorkbookSource = {
  sheetImport?: import("./sheet-import-state").SheetImportState;
  id?: string;
  fileName: string;
  buffer: ArrayBuffer;
  bufferLoaded: boolean;
  sheetName: string;
  sheetPath: string;
  columns: Record<string, string>;
  sheets: WorkbookSheet[];
};

export type WorkbookSheetKind = "testcase" | "result" | "defect" | "summary" | "data" | "other";

export type WorkbookSheet = {
  defects?: TestDefect[];
  sheetId?: number;
  name: string;
  path: string;
  order: number;
  kind: WorkbookSheetKind;
  testCaseIds: string[];
  imageCount: number;
  hidden: boolean;
};

export type ProjectSheetMapping = {
  projectId: string;
  spreadsheetId: string;
  sheetId: number;
  sheetName: string;
  testcaseKey: string;
  mappedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkbookSheetContent = {
  cells: Array<{ ref: string; value: string }>;
  truncatedCellCount: number;
  images: Array<{ name: string; mimeType: string; bytes: Uint8Array; row: number; column: number }>;
};

export type WorkbookResultImage = WorkbookSheetContent["images"][number] & {
  sheetName: string;
  testCaseId: string;
  resultId: string;
};

export type WorkbookFreeformResult = {
  sheetSections?: import("./sheet-sections").SheetSection[];
  sheetName: string;
  testCaseId: string;
  resultId: string;
  actualResult: string;
  apiResponse: string;
  log: string;
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
  canView: boolean;
  canEdit: boolean;
  canManage: boolean;
  canDelete: boolean;
  sprintId?: string;
  year?: number;
  updatedAt?: string;
};

export type WorkspaceYear = { id: string; groupId: string; year: number };
export type Sprint = { id: string; yearId: string; groupId: string; name: string; year: number; startDate: string; endDate: string; goal?: string; status?: 'Planned' | 'Active' | 'Completed'; updatedAt?: string; canManage?: boolean };
export type ProjectHistoryEntry = { id: string; actor_email: string; before_data: Record<string, unknown> | null; after_data: Record<string, unknown>; created_at: string };

export type Group = {
  id: string;
  name: string;
  description: string;
  projectCount: number;
  createdAt: string;
  canAccess: boolean;
  canManage: boolean;
  canDelete?: boolean;
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
  id: string | null;
  email: string;
  displayName: string;
  isAuthorized: boolean;
  isSystemOwner: boolean;
  appRole: "qa" | "po";
  lastSignInAt: string | null;
};
