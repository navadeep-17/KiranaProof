import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session-proxy";
import { isPublicSupplierReplyPath } from "@/lib/supabase/proxy-policy";

export async function proxy(request: NextRequest) {
  // Suppliers are not KiranaProof account holders; a scoped expiring bearer token
  // authenticates this ONE endpoint. All retailer APIs remain login-gated.
  if (isPublicSupplierReplyPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/v1/:path*"],
};
