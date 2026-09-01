import { z } from 'zod';

export const centrifugePppSampleInputSchema = z.object({
  sampleNumber: z.number().int().min(1).max(5),
  pltResult: z.coerce.number().positive('PLT result must be a positive number'),
  centrifugeSpeedRpm: z.coerce.number().positive('Centrifuge speed must be a positive number'),
  centrifugeTimeMinutes: z.coerce.number().positive('Centrifuge time must be a positive number'),
});

export const centrifugePppDraftSchema = z.object({
  calibrationDate: z.string().min(1, 'Calibration date is required'),
  nextDueDate: z.string().optional(),
  comment: z.string().optional(),
  problem: z.string().optional(),
  correctiveAction: z.string().optional(),
  samples: z.array(centrifugePppSampleInputSchema).length(5),
});

export const centrifugePppReviewSchema = z.object({
  reviewDecision: z.enum(['Reviewed', 'Returned']),
  reviewComment: z.string().optional(),
});

export const centrifugePppApprovalSchema = z.object({
  approvalDecision: z.enum(['Approved', 'Returned']),
  approvalComment: z.string().optional(),
});

export const centrifugePppEvidenceReplaceSchema = z.object({
  replacementReason: z.string().min(1, 'Replacement reason is required'),
});

export type CentrifugePppDraftFormData = z.infer<typeof centrifugePppDraftSchema>;
export type CentrifugePppReviewFormData = z.infer<typeof centrifugePppReviewSchema>;
export type CentrifugePppApprovalFormData = z.infer<typeof centrifugePppApprovalSchema>;
