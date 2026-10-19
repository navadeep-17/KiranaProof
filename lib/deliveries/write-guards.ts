/**
 * JSON write endpoints require browser same-origin requests. Cross-site form
 * posts and authenticated requests from a hostile Origin are rejected.
 * This is defense in depth for cookie-based Supabase sessions.
 */
export type GuardFailure = { status: 403 | 413 | 415; error: string };

export function checkWriteRequest(
  request: Pick<Request, "headers" | "url">,
): GuardFailure | null {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|\s*$)/i.test(contentType)) {
    return { status: 415, error: "Content-Type must be application/json." };
  }
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") {
    return { status: 403, error: "Cross-site writes are not permitted." };
  }
  const origin = request.headers.get("origin");
  if (origin) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      return { status: 403, error: "Invalid request origin." };
    }
    if (parsed.origin !== new URL(request.url).origin) {
      return { status: 403, error: "Request origin does not match this application." };
    }
  }
  const length = request.headers.get("content-length");
  if (length !== null && /^\d+$/.test(length) && Number(length) > 160_000) {
    return { status: 413, error: "Delivery request exceeds maximum size." };
  }
  return null;
}
