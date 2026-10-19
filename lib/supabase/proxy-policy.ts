/** Only the specific one-time supplier reply API bypasses retailer session auth. */
export function isPublicSupplierReplyPath(pathname: string): boolean {
  return /^\/api\/v1\/supplier\/[a-f0-9]{64}\/reply\/?$/.test(pathname);
}
