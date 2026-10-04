import { test } from "node:test";
import assert from "node:assert/strict";
import { EditorState } from "@codemirror/state";
import { highlightField, addHighlight, readHighlights, highlightTargets } from "./result-highlights";

test("navigation counts colored text as well as backgrounds, but not neutral styles or whitespace", () => {
  const text = "first\nsecond\nthird";
  assert.deepEqual(highlightTargets(text, [
    { start: 0, end: 5, bold: true }, { start: 0, end: 5, color: "rgb(17, 85, 204)" },
    { start: 0, end: 5, background: "#ffffff" },
    { start: 5, end: 6, background: "yellow" },
    { start: 6, end: 9, background: "yellow" },
    { start: 9, end: 12, background: "yellow", bold: true },
    { start: 13, end: 18, background: "#fde68a" },
  ]), [{ start: 0, end: 5, line: 1 }, { start: 6, end: 12, line: 2 }, { start: 13, end: 18, line: 3 }]);
  assert.deepEqual(highlightTargets(text, [{ start: 0, end: 5, color: "#000000" }, { start: 6, end: 12, color: "rgb(0, 0, 0)" }]), []);
});

test("highlight moves with edits and remains serializable for Result storage", () => {
  let state = EditorState.create({ doc: "hello world", extensions: [highlightField] });
  state = state.update({ effects: addHighlight.of({ start: 6, end: 11, background: "#fde68a" }) }).state;
  state = state.update({ changes: { from: 0, insert: "API: " } }).state;
  assert.deepEqual(readHighlights(state), [{ start: 11, end: 16, background: "#fde68a" }]);
  state = state.update({ changes: { from: 11, to: 16 } }).state;
  assert.deepEqual(readHighlights(state), []);
});
