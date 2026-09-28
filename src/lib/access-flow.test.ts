import assert from "node:assert/strict";
import test from "node:test";
import { authorizedDestination, pendingAccessDestination } from "./access-flow";

test("pending access keeps the signed-in email and requested destination", () => {
  assert.equal(
    pendingAccessDestination("New.User@example.com", "/groups/team-1?tab=projects"),
    "/auth/access-denied?email=new.user%40example.com&next=%2Fgroups%2Fteam-1%3Ftab%3Dprojects",
  );
});

test("approved QA returns to the originally requested protected page", () => {
  assert.equal(authorizedDestination("qa", "/groups/team-1/projects", true), "/groups/team-1/projects");
});

test("newly approved Google user finishes password setup before entering the app", () => {
  assert.equal(authorizedDestination("qa", "/groups", false), "/auth/update-password");
});

test("approved PO is routed only to the approvals area", () => {
  assert.equal(authorizedDestination("po", "/groups", true), "/approvals");
});
