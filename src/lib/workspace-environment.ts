/** Spreadsheet dropdown prompts do not identify a testing environment. */
export function workspaceEnvironment(cases: { environment: string }[], projectEnvironment?: string) {
  return cases.find(item => item.environment.trim() && !/^(please\s+select(?:\.{3})?|select|เลือก|กรุณาเลือก)$/i.test(item.environment.trim()))?.environment ?? projectEnvironment;
}
