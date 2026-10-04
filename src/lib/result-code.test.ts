import { test } from "node:test";
import assert from "node:assert/strict";
import { resultFoldRanges, inspectResultJson, resultJsonTokens } from "./result-code";

test("JSON property fragments without an outer brace get colors and an incomplete JSON warning", () => {
  const text = '"usageSummaryList": [\n{"quotaType":"NO-USE-NO-PAY"}\n]';
  assert.deepEqual(inspectResultJson(text), { isJsonLike: true, valid: false });
  assert.deepEqual(resultJsonTokens(text).map(token => [text.slice(token.from, token.to), token.kind]), [
    ['"usageSummaryList"', 'key'], ['"quotaType"', 'key'], ['"NO-USE-NO-PAY"', 'string'],
  ]);
});

test("colors JSON keys and values inside mixed logs including an unfinished block", () => {
  const text = 'INFO request\nRequest body: {"key":"value","count":2,"ok":true,"data":null}\nResponse body: {"error":"unfinished';
  const tokens = resultJsonTokens(text);
  assert.deepEqual(tokens.map(token => [text.slice(token.from, token.to), token.kind]), [
    ['"key"', 'key'], ['"value"', 'string'], ['"count"', 'key'], ['2', 'number'],
    ['"ok"', 'key'], ['true', 'literal'], ['"data"', 'key'], ['null', 'literal'],
    ['"error"', 'key'], ['"unfinished', 'string'],
  ]);
  assert.deepEqual(resultJsonTokens('INFO [start] plain message'), []);
});

test("sheet foreground highlights override only their text, not surrounding syntax colors", () => {
  const text = 'response={"key":"value"}';
  const start = text.indexOf('value');
  const tokens = resultJsonTokens(text, [{ start, end: start + 5, color: "#008000", background: "yellow" }]);
  assert.ok(tokens.some(token => token.kind === 'key'));
  assert.ok(tokens.every(token => token.to <= start || token.from >= start + 5));
  assert.equal(resultJsonTokens(text, [{ start, end: start + 5, background: "yellow" }]).length, 2);
  assert.equal(resultJsonTokens(text, [{ start: 0, end: text.length, color: "#000000" }]).length, 2);
});

test("incomplete JSON remains recognizable and reports invalid syntax without altering text", () => {
  assert.deepEqual(inspectResultJson('{\n "status": {"code": 200}'), { isJsonLike: true, valid: false });
  assert.deepEqual(inspectResultJson('[{"id": 1},'), { isJsonLike: true, valid: false });
  assert.deepEqual(inspectResultJson('{"status":"ok"}'), { isJsonLike: true, valid: true });
  assert.deepEqual(inspectResultJson('[INFO] request done'), { isJsonLike: false, valid: false });
  assert.deepEqual(inspectResultJson('Alice - HTTP Inspector\nResponse body: {"status":"ok"}'), { isJsonLike: false, valid: false });
});

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
