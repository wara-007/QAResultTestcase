/** Only initial reads and explicit Cover previews need its values. Repeating
 * this request for every detail batch consumes the same per-user read budget. */
export function needsCoverSnapshot(options: {summary?: boolean; sheetName?: string; sheetNames?: string[]; testcaseId?: string}, coverName: string): boolean {
  return options.summary === true || !(options.sheetName || options.sheetNames?.length || options.testcaseId)
    || options.sheetName === coverName || options.sheetNames?.includes(coverName) === true;
}
