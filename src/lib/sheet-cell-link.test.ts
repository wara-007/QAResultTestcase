import test from "node:test";
import assert from "node:assert/strict";
import { sheetCellLink } from "./sheet-cell-link";
test("extracts video links from Google Drive smart chips", () => {
  assert.equal(sheetCellLink({ chipRuns: [{ chip: { richLinkProperties: { uri: "https://drive.google.com/open?id=video" } } }, { startIndex: 31 }] }), "https://drive.google.com/open?id=video");
});

test("keeps Drive links hidden behind rich text file titles", () => {
  assert.equal(sheetCellLink({ textFormatRuns: [{ format: { link: { uri: "https://drive.google.com/open?id=proof" } } }] }), "https://drive.google.com/open?id=proof");
});
test("reads HYPERLINK formulas and rejects unsafe destinations", () => {
  assert.equal(sheetCellLink({ userEnteredValue: { formulaValue: '=HYPERLINK("https://drive.google.com/open?id=proof","Result")' } }), "https://drive.google.com/open?id=proof");
  assert.equal(sheetCellLink({ hyperlink: "javascript:alert(1)" }), undefined);
});
