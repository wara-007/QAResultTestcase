export type TextHighlight = { start: number; end: number; color?: string; background?: string; bold?: boolean };
export type StyledSheetText = { value: string; color?: string; background?: string; bold?: boolean; runs?: Array<{ start: number; color?: string; bold?: boolean }> };

export function sheetTextHighlights(text: string, cells: StyledSheetText[]): TextHighlight[] {
  const marks: TextHighlight[] = [];
  let cursor = 0;
  for (const cell of cells) {
    const value = cell.value.trim();
    if (!value) continue;
    const start = text.indexOf(value, cursor);
    if (start < 0) continue;
    cursor = start + value.length;
    const trim = cell.value.length - cell.value.trimStart().length;
    const runs = [{ start: 0 }, ...(cell.runs ?? [])].sort((a, b) => a.start - b.start);
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      const from = Math.max(0, run.start - trim), to = Math.min(value.length, (runs[i + 1]?.start ?? cell.value.length) - trim);
      if (to <= from) continue;
      const style = { color: run.color ?? cell.color, background: cell.background, bold: run.bold ?? cell.bold };
      if (style.color || style.background || style.bold) marks.push({ start: start + from, end: start + to, ...style });
    }
  }
  return marks;
}

export function splitHighlightedText(text: string, marks: TextHighlight[] = []) {
  const boundaries = [...new Set([0, text.length, ...marks.flatMap(m => [Math.max(0, Math.min(text.length, m.start)), Math.max(0, Math.min(text.length, m.end))])])].sort((a, b) => a - b);
  return boundaries.slice(0, -1).map((start, i) => ({ text: text.slice(start, boundaries[i + 1]), ...marks.filter(m => m.start <= start && m.end > start).reduce((style, m) => ({ ...style, color: m.color, background: m.background, bold: m.bold }), {} as Pick<TextHighlight, "color" | "background" | "bold">) }));
}

export function isImportedEvidenceDisplayed(sheet: string, row: number, column: number, evidence: Array<{ name: string }>) {
  const key = `sheet-${sheet}-${row}-${column}`.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return evidence.some(item => item.name.includes(`${key}-`));
}

export type RowLoadState = "queued" | "loading" | "loaded" | "error";
export function sheetRowState(sheetAlias: string, states: Record<string, RowLoadState>, hasResults = false): RowLoadState | "idle" {
  return states[sheetAlias || "Testcase"] ?? (hasResults ? "loaded" : "idle");
}
export async function loadRows<T>(keys: string[], loader: (key: string) => Promise<T>, update: (key: string, state: RowLoadState) => void, concurrency = 3) {
  const results: PromiseSettledResult<T>[] = new Array(keys.length);
  let cursor = 0;
  keys.forEach(key => update(key, "queued"));
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), keys.length) }, async () => {
    while (cursor < keys.length) {
      const index = cursor++, key = keys[index];
      update(key, "loading");
      try { results[index] = { status: "fulfilled", value: await loader(key) }; update(key, "loaded"); }
      catch (reason) { results[index] = { status: "rejected", reason }; update(key, "error"); }
    }
  }));
  return results;
}
