import test from "node:test";
import assert from "node:assert/strict";
import { filterProjects } from "./project-search";
import type { Project } from "./types";

const project = (overrides: Partial<Project>): Project => ({
  id: "project-1",
  name: "IR Cross Sell",
  description: "Roaming checkout",
  sprintNo: "Sprint 41",
  environment: "UAT",
  googleSheetId: "sheet-abc-123",
  googleSheetUrl: "https://docs.google.com/spreadsheets/d/sheet-abc-123/edit",
  createdAt: "2026-09-29T00:00:00.000Z",
  canView: true,
  canEdit: false,
  canManage: false,
  canDelete: false,
  ...overrides,
});

const projects = [
  project({ id: "p1", name: "IR Cross Sell" }),
  project({ id: "p2", name: "Payment", description: "Checkout wallet", environment: "SIT", sprintNo: "Sprint 42", googleSheetId: "payment-sheet", googleSheetUrl: "https://docs.google.com/spreadsheets/d/payment-sheet/edit" }),
];

test("keeps the original ordering for an empty query", () => {
  assert.deepEqual(filterProjects(projects, "   ").map((item) => item.id), ["p1", "p2"]);
});

test("matches project text case-insensitively and collapses query whitespace", () => {
  assert.deepEqual(filterProjects(projects, "  ir   CROSS  ").map((item) => item.id), ["p1"]);
});

test("searches description, environment, sprint, Google URL, and Google ID", () => {
  assert.deepEqual(filterProjects(projects, "wallet").map((item) => item.id), ["p2"]);
  assert.deepEqual(filterProjects(projects, "sit").map((item) => item.id), ["p2"]);
  assert.deepEqual(filterProjects(projects, "sprint 42").map((item) => item.id), ["p2"]);
  assert.deepEqual(filterProjects(projects, "payment-sheet").map((item) => item.id), ["p2"]);
  assert.deepEqual(filterProjects(projects, "docs.google.com").map((item) => item.id), ["p1", "p2"]);
});
