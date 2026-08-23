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

export const CORRECTED_RESULT_STATUSES = ['Open', 'Completed', 'Pending Review'] as const;

export type CorrectedResultStatus = (typeof CORRECTED_RESULT_STATUSES)[number];

const correctedResultSharedFields = {
  date: z.string().min(1, 'Correction date is required'),
  patientName: z.string().optional(),
  patientId: z.string().min(1, 'Patient ID is required'),
  labAccession: z.string().optional(),
  test: z.string().min(1, 'Test is required'),
  correctedResult: z.string().min(1, 'Corrected result is required'),
  reason: z.string().min(1, 'Reason is required'),
  status: z.enum(CORRECTED_RESULT_STATUSES).default('Open'),
  physicianNotified: z.boolean(),
  notifiedTo: z.string().optional(),
  notificationTime: z.string().optional(),
  notes: z.string().optional(),
};

function applyNotificationRequirements(
  data: {
    physicianNotified: boolean;
    notificationTime?: string;
    notifiedTo?: string;
  },
  ctx: z.RefinementCtx,
) {
  if (data.physicianNotified && !data.notificationTime?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Notification time is required when physician is notified',
      path: ['notificationTime'],
    });
  }
  if (data.physicianNotified && !data.notifiedTo?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Notified to is required when physician is notified',
      path: ['notifiedTo'],
    });
  }
}

export const correctedResultUpdateFormSchema = z
  .object(correctedResultSharedFields)
  .superRefine(applyNotificationRequirements);

export const correctedResultFormSchema = correctedResultUpdateFormSchema.extend({
  originalResult: z.string().min(1, 'Original result is required'),
});

export type CorrectedResultFormData = z.infer<typeof correctedResultFormSchema>;

export type CorrectedResultUpdateFormData = z.infer<typeof correctedResultUpdateFormSchema>;

export function emptyCorrectedResultForm(): CorrectedResultFormData {
  return {
    date: new Date().toISOString().slice(0, 10),
    patientName: '',
    patientId: '',
    labAccession: '',
    test: '',
    originalResult: '',
    correctedResult: '',
    reason: '',
    status: 'Open',
    physicianNotified: false,
    notifiedTo: '',
    notificationTime: '',
    notes: '',
  };
}
