import { z } from 'zod';

export const CRITICAL_VALUE_REVIEW_STATUSES = [
  'Pending Review',
  'Reviewed',
  'Needs Follow-up',
] as const;

export type CriticalValueReviewStatus = (typeof CRITICAL_VALUE_REVIEW_STATUSES)[number];

export const criticalValueReviewSchema = z.object({
  reviewStatus: z.enum(CRITICAL_VALUE_REVIEW_STATUSES),
  reviewComment: z.string().optional(),
});

export type CriticalValueReviewData = z.infer<typeof criticalValueReviewSchema>;
