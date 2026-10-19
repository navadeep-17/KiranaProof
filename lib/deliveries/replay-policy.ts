export type ReplayResolution = "REUSE" | "UPDATE_SAVED_DRAFT" | "CONFIRMED_CONFLICT";

export function getReplayResolution(
  previousSnapshot: string | null,
  currentSnapshot: string,
  status: string,
): ReplayResolution {
  if(previousSnapshot===null || previousSnapshot===currentSnapshot) return "REUSE";
  if(status==="RECONCILED" || status==="HAS_DISCREPANCY") return "CONFIRMED_CONFLICT";
  return "UPDATE_SAVED_DRAFT";
}
