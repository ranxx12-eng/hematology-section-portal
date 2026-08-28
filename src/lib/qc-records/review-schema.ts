import { z } from 'zod';
import { QC_DECISIONS } from './constants';

const qcDecisionSchema = z.enum(QC_DECISIONS);

function requiresAdditionalComment(decision: z.infer<typeof qcDecisionSchema>): boolean {
  return decision === 'not_accept' || decision === 'need_follow_up';
}

export const qcReviewFormSchema = z.object({
  reviewDecision: qcDecisionSchema,
  reviewComment: z.string().optional(),
}).superRefine((data, ctx) => {
  if (requiresAdditionalComment(data.reviewDecision) && !data.reviewComment?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Additional comment is required for this review decision',
      path: ['reviewComment'],
    });
  }
});

export type QCReviewFormData = z.infer<typeof qcReviewFormSchema>;

export const qcApprovalFormSchema = z.object({
  approvalDecision: qcDecisionSchema,
  approvalComment: z.string().optional(),
}).superRefine((data, ctx) => {
  if (requiresAdditionalComment(data.approvalDecision) && !data.approvalComment?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Additional comment is required for this approval decision',
      path: ['approvalComment'],
    });
  }
});

export type QCApprovalFormData = z.infer<typeof qcApprovalFormSchema>;

export function emptyQCReviewForm(): QCReviewFormData {
  return { reviewDecision: 'accept', reviewComment: '' };
}

export function emptyQCApprovalForm(): QCApprovalFormData {
  return { approvalDecision: 'accept', approvalComment: '' };
}
