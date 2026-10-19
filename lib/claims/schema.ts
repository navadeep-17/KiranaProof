import { z } from "zod";

export const approveClaimSchema = z.object({
  approved: z.literal(true),
  expectedVersion: z.number().int().positive(),
}).strict();

export const issueShareLinkSchema = z.object({
  confirmShare: z.literal(true),
  expiresInDays: z.number().int().min(1).max(7),
}).strict();

export const supplierResponseSchema = z.object({
  responseType: z.enum(["ACKNOWLEDGED", "PROPOSED_RESOLUTION", "DISPUTED"]),
  note: z.string().trim().max(1000),
}).strict().superRefine((input, ctx) => {
  if (input.responseType !== "ACKNOWLEDGED" && input.note.length < 3) {
    ctx.addIssue({code:"custom",path:["note"],message:"Explain the proposed resolution or dispute."});
  }
});

export const resolveClaimSchema = z.object({
  resolutionType: z.enum(["REPLACED", "CREDITED", "OTHER"]),
  note: z.string().trim().min(3).max(1000),
}).strict();
