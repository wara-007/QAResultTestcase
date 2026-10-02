import { test } from "node:test";
import assert from "node:assert/strict";
import { resultFoldRanges } from "./result-code";

test("folds nested JSON inside logs without treating quoted brackets as structure", () => {
  const text = 'INFO response:\n{\n "text": "} [",\n "items": [\n  1\n ]\n}\nfinished';
  const ranges = resultFoldRanges(text);
  assert.equal(ranges.length, 2);
  assert.equal(text.slice(ranges[0].from, ranges[0].to), '\n "text": "} [",\n "items": [\n  1\n ]\n');
  assert.equal(text.slice(ranges[1].from, ranges[1].to), '\n  1\n ');
});

test("does not fold ordinary or unfinished logs", () => {
  assert.deepEqual(resultFoldRanges('INFO [start]\nnot json {\nunfinished'), []);
});
