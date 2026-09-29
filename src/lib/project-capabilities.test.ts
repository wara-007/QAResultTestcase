import test from "node:test";
import assert from "node:assert/strict";
import { projectCapabilitiesFromRow } from "./project-capabilities";

test("maps an authorized non-member to view-only access", () => {
  assert.deepEqual(projectCapabilitiesFromRow({
    can_view: true,
    can_edit: false,
    can_manage: false,
    can_delete: false,
  }), {
    canView: true,
    canEdit: false,
    canManage: false,
    canDelete: false,
  });
});

test("does not imply manage or delete access from edit access", () => {
  assert.deepEqual(projectCapabilitiesFromRow({
    can_view: true,
    can_edit: true,
    can_manage: false,
    can_delete: false,
  }), {
    canView: true,
    canEdit: true,
    canManage: false,
    canDelete: false,
  });
});

test("preserves full owner or System Owner capabilities", () => {
  assert.deepEqual(projectCapabilitiesFromRow({
    can_view: true,
    can_edit: true,
    can_manage: true,
    can_delete: true,
  }), {
    canView: true,
    canEdit: true,
    canManage: true,
    canDelete: true,
  });
});

test("treats missing capability values as denied", () => {
  assert.deepEqual(projectCapabilitiesFromRow({}), {
    canView: false,
    canEdit: false,
    canManage: false,
    canDelete: false,
  });
});
