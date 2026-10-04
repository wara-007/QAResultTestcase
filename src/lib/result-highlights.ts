import { EditorState, StateEffect, StateField } from "@codemirror/state";
import type { TextHighlight } from "./result-preview";

export const addHighlight = StateEffect.define<TextHighlight>();
export const clearHighlights = StateEffect.define<null>();
export const highlightField = StateField.define<TextHighlight[]>({
  create: () => [],
  update(marks, transaction) {
    let next = marks.map(mark => ({ ...mark, start: transaction.changes.mapPos(mark.start, 1), end: transaction.changes.mapPos(mark.end, -1) })).filter(mark => mark.end > mark.start);
    for (const effect of transaction.effects) {
      if (effect.is(clearHighlights)) next = [];
      if (effect.is(addHighlight) && effect.value.end > effect.value.start) next = [...next, effect.value];
    }
    return next.sort((a, b) => a.start - b.start);
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
