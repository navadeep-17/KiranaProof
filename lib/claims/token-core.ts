import { createHash, randomBytes } from "node:crypto";

export function isSupplierToken(token:string):boolean {
  return /^[0-9a-f]{64}$/.test(token);
}
export function createSupplierToken():string {
  return randomBytes(32).toString("hex");
}
export function hashSupplierToken(token:string):string {
  if(!isSupplierToken(token)) throw new Error("Invalid supplier token format");
  return createHash("sha256").update(token,"ascii").digest("hex");
}
