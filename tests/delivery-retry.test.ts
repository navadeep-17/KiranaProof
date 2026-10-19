import assert from "node:assert/strict";
import test from "node:test";
import { getReplayResolution } from "../lib/deliveries/replay-policy.ts";

test("retry same input never creates a second record or overwrites original",()=>{
  assert.equal(getReplayResolution('{"qty":8}','{"qty":8}',"NEEDS_REVIEW"),"REUSE");
  assert.equal(getReplayResolution(null,'{"qty":8}',"NEEDS_REVIEW"),"REUSE");
});
test("edited input after uncertain create becomes a version-checked update",()=>{
  assert.equal(getReplayResolution('{"qty":8}','{"qty":6}',"NEEDS_REVIEW"),"UPDATE_SAVED_DRAFT");
});
test("a confirmed old request cannot be overwritten by changed retry",()=>{
  assert.equal(getReplayResolution('{"qty":8}','{"qty":6}',"RECONCILED"),"CONFIRMED_CONFLICT");
  assert.equal(getReplayResolution('{"qty":8}','{"qty":6}',"HAS_DISCREPANCY"),"CONFIRMED_CONFLICT");
});
