import assert from "node:assert/strict";
import test from "node:test";
import { isPublicSupplierReplyPath } from "../lib/supabase/proxy-policy.ts";

const token="a".repeat(64);
test("scoped supplier reply needs a token but not a retailer login",()=>{
  assert.equal(isPublicSupplierReplyPath(`/api/v1/supplier/${token}/reply`),true);
  assert.equal(isPublicSupplierReplyPath(`/api/v1/supplier/${token}/reply/`),true);
});
test("retailer approval/claims APIs stay authentication-gated",()=>{
  for(const path of [
    "/api/v1/deliveries","/api/v1/deliveries/123/claim",
    "/api/v1/claims/123/share","/api/v1/claims/123/revoke-share",
    "/api/v1/claims/123/resolve", "/dashboard",
    "/api/v1/supplier/short/reply",
    `/api/v1/supplier/${token}/reply/another-route`,
    `/api/v1/supplier/${token}/read`,
  ]) assert.equal(isPublicSupplierReplyPath(path),false,path);
});
