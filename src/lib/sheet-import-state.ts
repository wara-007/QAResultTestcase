import type { RowLoadState } from "./result-preview";

export type SheetImportState = {
  version: 1;
  spreadsheetId: string;
  states: Record<string, RowLoadState>;
  loadedAt: Record<string, string>;
  attemptedAt: string;
  complete: boolean;
  refreshRequired?: boolean;
};

export function readSheetImportState(value: unknown, spreadsheetId?: string): SheetImportState | undefined {
  if (!value || typeof value !== "object") return;
  const input = value as Partial<SheetImportState>;
  if (input.version !== 1 || typeof input.spreadsheetId !== "string" || (spreadsheetId !== undefined && input.spreadsheetId !== spreadsheetId)
    || !input.states || !input.loadedAt || !Number.isFinite(Date.parse(input.attemptedAt ?? ""))) return;
  const states: Record<string, RowLoadState> = {};
  const loadedAt: Record<string, string> = {};
  for (const [key, state] of Object.entries(input.states)) {
    if (!["queued", "loading", "loaded", "error"].includes(state)) return;
    if (state === "loaded") {
      if (!Number.isFinite(Date.parse(input.loadedAt[key] ?? ""))) return;
      loadedAt[key] = input.loadedAt[key];
    }
    states[key] = state === "loading" ? "queued" : state;
  }
  return { version: 1, spreadsheetId: input.spreadsheetId, states, loadedAt, attemptedAt: input.attemptedAt!, complete: input.complete === true, refreshRequired: input.refreshRequired === true };
}

export function checkpointSheetImport(previous: SheetImportState | undefined, spreadsheetId: string, updates: Record<string, RowLoadState>, at: string, complete: boolean): SheetImportState {
  const prior = readSheetImportState(previous, spreadsheetId);
  const states = { ...prior?.states };
  const loadedAt = { ...prior?.loadedAt };
  for (const [key, state] of Object.entries(updates)) {
    // Failed refreshes do not erase the last successfully saved snapshot.
    states[key] = state === "loaded" || prior?.states[key] !== "loaded" ? state : "loaded";
    if (state === "loaded") loadedAt[key] = at;
  }
  return { version: 1, spreadsheetId, states, loadedAt, attemptedAt: at, complete, refreshRequired: complete ? false : prior?.refreshRequired === true };
}

export function shouldStartSheetImport(spreadsheetId: string, canEdit: boolean, caseCount: number, saved: SheetImportState | undefined): boolean {
  if (!spreadsheetId || !canEdit) return false;
  const snapshot = readSheetImportState(saved, spreadsheetId);
  return snapshot ? !snapshot.complete || snapshot.refreshRequired === true : caseCount === 0;
}

export function pendingImportSheets(names: string[], saved: SheetImportState | undefined): string[] {
  return names.filter(name => saved?.states[name] !== "loaded");
}
