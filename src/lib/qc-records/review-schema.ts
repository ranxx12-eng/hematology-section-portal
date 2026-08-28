import { z } from 'zod';

export const qcReviewFormSchema = z.object({
  reviewComment: z.string().optional(),
});

export type QCReviewFormData = z.infer<typeof qcReviewFormSchema>;

export const qcApprovalFormSchema = z.object({
  approvalComment: z.string().optional(),
});

export type QCApprovalFormData = z.infer<typeof qcApprovalFormSchema>;
