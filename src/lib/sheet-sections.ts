import type { TextHighlight } from "./result-preview";
import { inspectResultJson } from "./result-code";

export type SheetSection = {
  kind?: SheetDisplayMode;
  sourceSectionIds?: string[];
  id: string;
  title: string;
  headers?: Array<{ ref: string; label: string }>;
  rows: Array<{ row: number; fields: Array<{ ref: string; label: string; value: string; link?: string; highlights?: TextHighlight[] }> }>;
};
export type SheetDisplayMode = "table" | "log" | "fields" | "text";
export type SheetDisplaySettings = { modes: Record<string, SheetDisplayMode>; groupTransactions?: boolean; joins?: Record<string, string> };
export type SheetField = SheetSection["rows"][number]["fields"][number];

export function sheetFieldDisplayLabel(field: SheetField): string {
  return /^ข้อมูลจาก\s+[A-Z]+\d+$/i.test(field.label.trim()) ? "" : field.label;
}

const logHeading = /^(?:logs?|บันทึก)\s*[:：]?\s*$/i;
const isLog = (value: string) => /\.log\b|["']@timestamp["']\s*:|\|\s*(?:INFO|DEBUG|ERROR|WARN)\s*\||["']txId["']\s*:/i.test(value);
const columnOf = (ref: string) => ref.replace(/\d+$/, "");

/** Code pasted into adjacent cells is evidence, not a form label/value pair. */
export function isSheetPayloadLabel(label: string): boolean {
  return /^[{}\[\],\s]+$/.test(label.trim()) || isCodeSheetField({ ref: "", label: "", value: label });
}

export function isCodeSheetField(field: SheetField): boolean {
  if (/^(?:[-–—]+|n\/?a)?$/i.test(field.value.trim())) return false;
  if (field.link && /^https?:\/\//i.test(field.link) && !/[\r\n]/.test(field.value)) return false;
  if (/^(?:result|screen\s*(?:recrod|record|recording))\s*[:：]*\s*$/i.test(field.value)) return false;
  if (inspectResultJson(field.value).isJsonLike) return true;
  // Generic column titles describe where QA put data, not its actual format.
  if (isLog(field.value) || /^\s*Endpoint\s*:\s*\S+/i.test(field.label)) return true;
  if (/^\s*(?:(?:\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}[^\n]*\b(?:INFO|DEBUG|ERROR|WARN|TRACE)\b)|(?:(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\S+)|HTTP\/\d(?:\.\d)?\s+\d{3}|kubectl\s+.*\blogs\b)/im.test(field.value)) return true;
  if (/\bHTTP Inspector\b|^\s*(?:Endpoint\s*:|(?:Request|Response)\s+(?:body|headers?|status|content type|cookies|time|size)\s*:|curl\s+(?:-[\w-]+\b|["']?https?:\/\/))/im.test(field.value)) return true;
  try {
    const parsed: unknown = JSON.parse(field.value);
    return parsed !== null && typeof parsed === "object";
  } catch { return false; }
}

/** A populated block after a completed payload starts a new spatial result.
 * Short heading-only blocks before a payload remain with that next block.
 * Content labels (Case, Endpoint, etc.) never determine the boundary.
 */
export function groupSheetResultSections(sections: SheetSection[]) {
  const groups: Array<{ startRow: number; sections: SheetSection[]; hasPayload: boolean }> = [];
  for (const section of sections) {
    const startRow = Math.min(...section.rows.map(row => row.row), ...(section.headers ?? []).map(header => Number(header.ref.match(/\d+$/)?.[0] ?? Infinity)));
    const hasPayload = section.kind === "log" || section.rows.some(row => row.fields.some(field => isCodeSheetField(field) && /\n|^[\[{]/.test(field.value)));
    const previous = groups.at(-1);
    if (previous && !previous.hasPayload) {
      previous.sections.push(section);
      previous.hasPayload = hasPayload;
    } else groups.push({ startRow, sections: [section], hasPayload });
  }
  return groups;
}

export function evidenceSectionIndex(name: string, sheetName: string, groups: Array<{ startRow: number }>) {
  const prefix = `sheet-${sheetName}-`.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const offset = name.indexOf(prefix);
  if (offset < 0 || !groups.length) return -1;
  const anchor = name.slice(offset + prefix.length).match(/^(\d+)-(\d+)-/);
  if (!anchor) return -1;
  const row = Number(anchor[1]) + 1; // OOXML image anchors are zero-based.
  let index = 0;
  groups.forEach((group, candidate) => { if (group.startRow <= row) index = candidate; });
  return index;
}

/** Keep source rows and columns; only infer a header when a block has a short label row. */
export function sheetSectionsFromCells(cells: Array<{ ref: string; value: string }>): SheetSection[] {
  const rows = new Map<number, typeof cells>();
  for (const cell of cells) {
    if (!cell.value.trim()) continue;
    const row = Number(cell.ref.match(/\d+$/)?.[0]);
    if (!row) continue;
    rows.set(row, [...(rows.get(row) ?? []), cell]);
  }
  const blocks: Array<Array<[number, typeof cells]>> = [];
  for (const entry of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
    const block = blocks.at(-1);
    if (!block || entry[0] > block.at(-1)![0] + 1) blocks.push([entry]);
    else block.push(entry);
  }
  const sections = blocks.map(block => {
    const first = block[0][1];
    const flat = block.flatMap(([, values]) => values);
    const singleColumn = new Set(flat.map(cell => columnOf(cell.ref))).size === 1;
    const log = singleColumn && flat.every(cell => logHeading.test(cell.value.trim()) || isLog(cell.value));
    const fields = !log && block.every(([, values]) => values.length === 2 && values[0].value.length < 80) && block.some(([, values]) => /^(?:device|environment|platform|app version|test data|ผู้ทดสอบ)\s*:?$/i.test(values[0].value.trim()));
    const isHeader = !fields && !log && block.length > 1 && first.length > 1 && first.every(cell =>
      (cell.value.trim().length <= 80 && !/[\n\r{}\[\]]/.test(cell.value)) ||
      (cell.value.trim().length <= 160 && /(?:^|\n)\s*\/\S*api\//i.test(cell.value) && !/[{}\[\]]/.test(cell.value)));
    const hasLogHeader = log && logHeading.test(first[0].value.trim());
    const labels = new Map(isHeader ? first.map(cell => [cell.ref.replace(/\d+$/, ""), cell.value.trim()]) : []);
    return {
      kind: (log ? "log" : fields ? "fields" : isHeader ? "table" : "text") as SheetDisplayMode,
      id: `rows-${block[0][0]}-${block.at(-1)![0]}`,
      title: `ข้อมูลจาก Sheets · แถว ${block[0][0]}–${block.at(-1)![0]}`,
      headers: isHeader || hasLogHeader ? first.map(cell => ({ ref: cell.ref, label: cell.value })) : undefined,
      rows: (isHeader || hasLogHeader ? block.slice(1) : block).map(([row, values]) => ({ row, fields: values.map(cell => ({ ...cell, label: labels.get(columnOf(cell.ref)) ?? `ข้อมูลจาก ${cell.ref}` })) })),
    };
  });
  const merged: SheetSection[] = [];
  for (const section of sections) {
    const previous = merged.at(-1);
    const column = columnOf(section.rows[0]?.fields[0]?.ref ?? section.headers?.[0]?.ref ?? "");
    const previousColumn = columnOf(previous?.rows[0]?.fields[0]?.ref ?? previous?.headers?.[0]?.ref ?? "");
    if (previous?.kind === "log" && section.kind === "log" && !section.headers && column === previousColumn) {
      previous.rows.push(...section.rows);
      previous.id = `${previous.id}-${section.id}`;
      previous.title = `Log · ${previous.headers?.[0]?.ref ?? previous.rows[0]?.fields[0]?.ref}–${section.rows.at(-1)?.fields.at(-1)?.ref}`;
    } else merged.push(section);
  }
  return merged;
}

export function combineSheetFields(fields: SheetField[]) {
  let offset = 0;
  const highlights: TextHighlight[] = [];
  for (const field of fields) {
    highlights.push(...(field.highlights ?? []).map(mark => ({ ...mark, start: mark.start + offset, end: mark.end + offset })));
    offset += field.value.length + 1;
  }
  return { text: fields.map(field => field.value).join("\n"), highlights };
}

/** Fixed name/value presentation without discarding parallel table columns. */
export function sectionFieldsForDisplay(section: SheetSection): SheetField[] {
  const fields = section.rows.flatMap(row => row.fields);
  // Matrix-style API evidence: a left-hand label names a payload spread
  // vertically in each adjacent column. Never concatenate parallel APIs.
  const markers = fields.filter(field => /^(?:curl|response|request|log)\s*[:：]+\s*$/i.test(field.value.trim()));
  if (markers.length && new Set(markers.map(field => columnOf(field.ref))).size === 1) {
    const markerColumn = columnOf(markers[0].ref);
    const firstMarkerRow = Number(markers[0].ref.match(/\d+$/)?.[0]);
    const payloadColumns = [...new Set(fields.filter(field => columnOf(field.ref) !== markerColumn && Number(field.ref.match(/\d+$/)?.[0]) >= firstMarkerRow).map(field => columnOf(field.ref)))];
    const used = new Set<string>();
    const combined: SheetField[] = [];
    for (const column of payloadColumns) {
      const header = section.headers?.find(header => columnOf(header.ref) === column);
      const heading = fields.find(field => columnOf(field.ref) === column && Number(field.ref.match(/\d+$/)?.[0]) < firstMarkerRow)
        ?? (header ? { ref: header.ref, value: header.label } : undefined);
      let hasPayload = false;
      markers.forEach((marker, index) => {
        const start = Number(marker.ref.match(/\d+$/)?.[0]);
        const end = Number(markers[index + 1]?.ref.match(/\d+$/)?.[0] ?? Infinity);
        const parts = fields.filter(field => columnOf(field.ref) === column && Number(field.ref.match(/\d+$/)?.[0]) >= start && Number(field.ref.match(/\d+$/)?.[0]) < end);
        if (!parts.length) return;
        hasPayload = true;
        parts.forEach(field => used.add(field.ref));
        used.add(marker.ref);
        const value = combineSheetFields(parts);
        combined.push({ ref: parts.map(field => field.ref).join(", "), label: `${heading?.value ?? column} · ${marker.value.replace(/[:：]+\s*$/, "").trim()}`, value: value.text, highlights: value.highlights });
      });
      if (hasPayload && heading) used.add(heading.ref);
    }
    if (combined.length) return [...fields.filter(field => !used.has(field.ref)), ...combined];
  }
  if (section.kind === "log") {
    if (!fields.length) return [];
    const combined = combineSheetFields(fields);
    return [{ label: "Log", ref: fields.map(field => field.ref).join(", "), value: combined.text, highlights: combined.highlights }];
  }
  if (section.kind === "fields") {
    return section.rows.flatMap(row => row.fields.length === 2
      ? [{ ...row.fields[1], label: row.fields[0].value, ref: `${row.fields[0].ref} / ${row.fields[1].ref}` }]
      : row.fields);
  }
  if (section.kind === "table" || section.kind === "text") {
    const used = new Set<string>();
    const payloads: SheetField[] = [];
    for (const column of new Set(fields.map(field => columnOf(field.ref)))) {
      const header = section.headers?.find(header => columnOf(header.ref) === column);
      const runs: SheetField[][] = [];
      for (const field of fields.filter(field => columnOf(field.ref) === column)) {
        const previous = runs.at(-1);
        const row = Number(field.ref.match(/\d+$/)?.[0]);
        if (!previous || row !== Number(previous.at(-1)!.ref.match(/\d+$/)?.[0]) + 1) runs.push([field]);
        else previous.push(field);
      }
      for (const parts of runs) {
        // Reconstruct only recognizable continuous code. A blank row in this
        // column is a boundary even when another column continues alongside it.
        const jsonFragments = parts.length > 1 && parts.some(field => /^\s*"[^"\n]+"\s*:/.test(field.value)) &&
          parts.every(field => /^(?:"[^"\n]+"\s*:[^\n]*|[{}\[\],\s]+|"(?:[^"\\]|\\.)*"\s*,?|(?:-?\d+(?:\.\d+)?|true|false|null)\s*,?)$/.test(field.value.trim()));
        const curl = /^\s*curl\s/.test(parts[0].value) && parts.slice(1).every(field => /^\s*--?[\w-]+\b/.test(field.value) || /\\\s*$/.test(field.value));
        const logs = parts.every(field => isLog(field.value) || /^\s*kubectl\s+.*\blogs\b/.test(field.value));
        if (parts.length < 2 || !(jsonFragments || curl || logs)) continue;
        const combined = combineSheetFields(parts);
        parts.forEach(field => used.add(field.ref));
        payloads.push({ ref: parts.map(field => field.ref).join(", "), label: header?.label ?? (logs ? "Log" : curl ? "Curl" : "JSON"), value: combined.text, highlights: combined.highlights });
      }
    }
    if (payloads.length) return [...fields.filter(field => !used.has(field.ref)), ...payloads];
  }
  return fields;
}

/** Parent transaction identifiers only; request/srv identifiers are not interchangeable. */
export function sectionLogGroups(section: SheetSection) {
  const groups = new Map<string | null, { transactionId: string | null; fields: SheetField[] }>();
  for (const field of section.rows.flatMap(row => row.fields)) {
    const pipeIds = [...field.value.matchAll(/\|\s*(?:INFO|DEBUG|WARN|ERROR)\s*\|[^|]*\|([^|]+)\|/g)].map(match => match[1].trim()).filter(Boolean);
    const topLevelId = (value: string): string | null => {
      const brace = value.indexOf("{");
      if (brace < 0) return null;
      try {
        const parsed = JSON.parse(value.slice(brace).trim());
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
        const id = parsed.txId ?? parsed.transactionId ?? parsed.correlationId ?? parsed.traceId;
        return typeof id === "string" && id.trim() ? id : null;
      } catch { return null; }
    };
    const wholeId = topLevelId(field.value);
    const ids = [...new Set(pipeIds.length ? pipeIds : wholeId ? [wholeId] : field.value.split("\n").flatMap(line => { const id = topLevelId(line); return id ? [id] : []; }))];
    const transactionId = ids.length === 1 ? ids[0] : null;
    const group = groups.get(transactionId) ?? { transactionId, fields: [] };
    group.fields.push(field);
    groups.set(transactionId, group);
  }
  return [...groups.values()];
}

export function sectionsForDisplay(sections: SheetSection[], settings: SheetDisplaySettings): SheetSection[] {
  const displayed: SheetSection[] = [];
  for (const section of sections) {
    const previous = displayed.at(-1);
    if (previous && previous.sourceSectionIds?.includes(settings.joins?.[section.id] ?? "")) {
      previous.rows.push(...section.rows);
      previous.headers = [...(previous.headers ?? []), ...(section.headers ?? [])];
      previous.sourceSectionIds!.push(section.id);
    } else displayed.push({ ...section, rows: [...section.rows], headers: section.headers ? [...section.headers] : undefined, sourceSectionIds: [section.id] });
  }
  return displayed;
}
