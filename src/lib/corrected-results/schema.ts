import { z } from 'zod';

export const CORRECTED_RESULT_TESTS = [
  'CBC',
  'PT/INR',
  'APTT',
  'D-Dimer',
  'Fibrinogen',
  'ESR',
  'Blood Smear',
  'Reticulocyte Count',
  'Hemoglobin',
  'Platelet Count',
  'WBC',
] as const;

export const correctedResultFormSchema = z.object({
  date: z.string().min(1, 'Correction date is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  test: z.string().min(1, 'Test is required'),
  originalResult: z.string().min(1, 'Original result is required'),
  correctedResult: z.string().min(1, 'Corrected result is required'),
  reason: z.string().min(1, 'Reason is required'),
  physicianNotified: z.boolean(),
  notificationTime: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.physicianNotified && !data.notificationTime?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Notification time is required when physician is notified',
      path: ['notificationTime'],
    });
  }
});

export type CorrectedResultFormData = z.infer<typeof correctedResultFormSchema>;

export type CorrectedResultUpdateFormData = Omit<CorrectedResultFormData, 'originalResult'>;

export const correctedResultUpdateFormSchema = correctedResultFormSchema.omit({ originalResult: true });

export function emptyCorrectedResultForm(): CorrectedResultFormData {
  return {
    date: new Date().toISOString().slice(0, 10),
    patientId: '',
    test: '',
    originalResult: '',
    correctedResult: '',
    reason: '',
    physicianNotified: false,
    notificationTime: '',
    notes: '',
  };
}
