type LinkedCell = { hyperlink?: string | null; userEnteredValue?: { formulaValue?: string | null } | null; textFormatRuns?: Array<{ format?: { link?: { uri?: string | null } | null } | null }> | null; chipRuns?: Array<{ startIndex?: number | null; chip?: { richLinkProperties?: { uri?: string | null } | null } | null }> | null };

export function sheetCellLink(cell: LinkedCell): string | undefined {
  const formula = cell.userEnteredValue?.formulaValue?.match(/^=HYPERLINK\(\s*"((?:[^"]|"")*)"/i)?.[1]?.replaceAll('""', '"');
  const candidates = [cell.hyperlink, ...(cell.chipRuns ?? []).map(run => run.chip?.richLinkProperties?.uri), ...(cell.textFormatRuns ?? []).map(run => run.format?.link?.uri), formula];
  return candidates.find((value): value is string => typeof value === "string" && /^https?:\/\//i.test(value));
}
