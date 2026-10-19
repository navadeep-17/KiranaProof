import { isSupplierToken } from "../claims/token-core.ts";

/**
 * Generate bearer links only against a trusted origin. In production we require
 * APP_PUBLIC_ORIGIN so a spoofed request Host cannot enter a retailer's share URL.
 */
export function buildSupplierShareUrl(
  token:string,requestUrl:string,configuredOrigin:string|undefined,isProduction:boolean,
):string {
  if(!isSupplierToken(token)) throw new Error("Invalid supplier token");
  let target:string;
  if(!configuredOrigin?.trim()){
    if(isProduction)throw new Error("APP_PUBLIC_ORIGIN is required before supplier links can be shared.");
    target=new URL(requestUrl).origin;
  }else{
    const parsed=new URL(configuredOrigin);
    const loopback=["localhost","127.0.0.1"].includes(parsed.hostname);
    if(parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=="/"||
      (parsed.protocol!=="https:"&&!(parsed.protocol==="http:"&&loopback))){
      throw new Error("APP_PUBLIC_ORIGIN must be a secure public HTTPS origin (or localhost for testing).");
    }
    target=parsed.origin;
  }
  return new URL("/supplier/"+token,target).toString();
}
