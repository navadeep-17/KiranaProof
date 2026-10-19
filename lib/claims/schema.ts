import { z } from "zod";

export const approveClaimSchema = z.object({
  approved: z.literal(true),
  expectedVersion: z.number().int().positive(),
  reviewedItems: z.array(z.object({
    index: z.number().int().min(0).max(74),
    note: z.string().trim().max(500),
  }).strict()).min(1).max(75),
}).strict().superRefine((value,ctx)=>{
  const ids=value.reviewedItems.map(item=>item.index);
  if(new Set(ids).size!==ids.length)
    ctx.addIssue({code:"custom",path:["reviewedItems"],message:"Each finding can be selected only once."});
});

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
