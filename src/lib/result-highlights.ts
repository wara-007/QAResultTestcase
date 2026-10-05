import { EditorState, StateEffect, StateField } from "@codemirror/state";
import type { TextHighlight } from "./result-preview";

export const addHighlight = StateEffect.define<TextHighlight>();
export const clearHighlights = StateEffect.define<null>();
function validMarks(marks: TextHighlight[], length: number): TextHighlight[] {
  return marks.flatMap(mark => {
    if (!Number.isFinite(mark.start) || !Number.isFinite(mark.end)) return [];
    const start = Math.max(0, Math.min(length, Math.trunc(mark.start)));
    const end = Math.max(0, Math.min(length, Math.trunc(mark.end)));
    return end > start ? [{ ...mark, start, end }] : [];
  });
}
export const highlightField = StateField.define<TextHighlight[]>({
  create: () => [],
  update(marks, transaction) {
    // Imported offsets may refer to longer source text. Validate against the old
    // document before mapPos (which throws out of range), then the new document.
    let next = validMarks(marks, transaction.startState.doc.length).map(mark => ({ ...mark, start: transaction.changes.mapPos(mark.start, 1), end: transaction.changes.mapPos(mark.end, -1) }));
    for (const effect of transaction.effects) {
      if (effect.is(clearHighlights)) next = [];
      if (effect.is(addHighlight)) next.push(...validMarks([effect.value], transaction.newDoc.length));
    }
    return validMarks(next, transaction.newDoc.length).sort((a, b) => a.start - b.start);
  },
});
export function readHighlights(state: EditorState) { return state.field(highlightField); }

export function highlightTargets(text: string, marks: TextHighlight[]) {
  const targets: { start: number; end: number; line: number }[] = [];
  for (const mark of [...marks].sort((a, b) => a.start - b.start)) {
    const background = mark.background?.toLowerCase().replace(/\s+/g, "");
    const color = mark.color?.toLowerCase().replace(/\s+/g, "");
    const hasBackground = Boolean(background && !["white", "#fff", "#ffffff", "transparent", "rgb(255,255,255)", "rgba(255,255,255,1)", "rgba(0,0,0,0)"].includes(background));
    const hasColor = Boolean(color && !["black", "#000", "#000000", "transparent", "inherit", "initial", "currentcolor", "rgb(0,0,0)", "rgba(0,0,0,1)", "rgba(0,0,0,0)"].includes(color));
    if (!hasBackground && !hasColor) continue;
    const start = Math.max(0, Math.min(text.length, mark.start));
    const end = Math.max(start, Math.min(text.length, mark.end));
    if (!text.slice(start, end).trim()) continue;
    const last = targets.at(-1);
    if (last && start <= last.end) last.end = Math.max(last.end, end);
    else targets.push({ start, end, line: text.slice(0, start).split("\n").length });
  }
  return targets;
}
