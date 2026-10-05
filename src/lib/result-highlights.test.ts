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

test("imported highlight beyond the document is clipped before subsequent search transactions", () => {
  let state = EditorState.create({ doc: "x".repeat(413), extensions: [highlightField] });
  state = state.update({ effects: [
    addHighlight.of({ start: 400, end: 420, background: "yellow" }),
    addHighlight.of({ start: 420, end: 430, color: "blue" }),
    addHighlight.of({ start: -5, end: 3, bold: true }),
    addHighlight.of({ start: NaN, end: 4, bold: true }),
  ] }).state;
  assert.deepEqual(readHighlights(state), [{ start: 0, end: 3, bold: true }, { start: 400, end: 413, background: "yellow" }]);
  // Same no-document-change transaction as setting a CodeMirror search query.
  state = state.update({}).state;
  assert.equal(readHighlights(state).at(-1)?.end, 413);
  state = state.update({ changes: { from: 410, to: 413 } }).state;
  assert.equal(readHighlights(state).at(-1)?.end, 410);
});

test("highlight added with a document replacement is validated against the new document", () => {
  let state = EditorState.create({ doc: "old", extensions: [highlightField] });
  state = state.update({ changes: { from: 0, to: 3, insert: "longer text" }, effects: addHighlight.of({ start: 7, end: 50, color: "red" }) }).state;
  assert.deepEqual(readHighlights(state), [{ start: 7, end: 11, color: "red" }]);
});
