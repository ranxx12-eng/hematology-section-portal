import { z } from 'zod';

export const QC_TESTS = [
  'CBC',
  'PT/INR',
  'APTT',
  'D-Dimer',
  'Fibrinogen',
  'ESR',
] as const;

export const QC_CONTROL_LEVELS = ['Level 1', 'Level 2', 'Level 3'] as const;

export const QC_STATUSES = ['accepted', 'warning', 'rejected', 'pending_review'] as const;

export const qcRecordFormSchema = z.object({
  instrumentId: z.string().min(1, 'Instrument is required'),
  test: z.string().min(1, 'Test is required'),
  controlLevel: z.string().min(1, 'Control level is required'),
  lotNumber: z.string().min(1, 'Lot number is required'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  recordedAt: z.string().min(1, 'Recorded date/time is required'),
  result: z.coerce.number(),
  mean: z.coerce.number(),
  standardDeviation: z.coerce.number().min(0),
  rangeMin: z.coerce.number(),
  rangeMax: z.coerce.number(),
  status: z.enum(QC_STATUSES),
  correctiveAction: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.rangeMax < data.rangeMin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Range max must be greater than or equal to range min',
      path: ['rangeMax'],
    });
  }
  if (data.mean === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Mean cannot be zero',
      path: ['mean'],
    });
  }
});

export type QCRecordFormData = z.infer<typeof qcRecordFormSchema>;

export function emptyQCRecordForm(): QCRecordFormData {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return {
    instrumentId: '',
    test: '',
    controlLevel: '',
    lotNumber: '',
    expiryDate: '',
    recordedAt: local,
    result: 0,
    mean: 0,
    standardDeviation: 0,
    rangeMin: 0,
    rangeMax: 0,
    status: 'pending_review',
    correctiveAction: '',
  };
}

export function calculateCvPercent(mean: number, standardDeviation: number): number {
  if (mean === 0) return 0;
  return Number(((standardDeviation / mean) * 100).toFixed(4));
}
