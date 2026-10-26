import assert from "node:assert/strict";
import test from "node:test";
import { workspaceEnvironment } from "./workspace-environment";
test("spreadsheet dropdown prompts fall back to the project environment", () => {
  assert.equal(workspaceEnvironment([{ environment: "Please Select" }], "UAT"), "UAT");
  assert.equal(workspaceEnvironment([{ environment: "" }, { environment: "Prepod" }], "UAT"), "Prepod");
});
