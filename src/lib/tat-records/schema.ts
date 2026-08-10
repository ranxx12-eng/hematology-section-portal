import { z } from 'zod';
import { calculateTATMinutes, getTATStatus } from '@/lib/calculations/tat';

export const TAT_TEST_TYPES = [
  'CBC',
  'PT/INR',
  'APTT',
  'D-Dimer',
  'Fibrinogen',
  'ESR',
  'Blood Smear',
  'Reticulocyte Count',
] as const;

export const TAT_DEPARTMENTS = ['Hematology', 'ER', 'ICU', 'Ward', 'OPD'] as const;

export const TAT_SHIFTS = ['morning', 'evening', 'night'] as const;

export const tatRecordFormSchema = z.object({
  sampleReceivedTime: z.string().min(1, 'Sample received time is required'),
  resultReleasedTime: z.string().min(1, 'Result released time is required'),
  targetTatMinutes: z.coerce.number().int().min(1),
  testType: z.string().min(1, 'Test type is required'),
  priority: z.enum(['stat', 'routine']),
  department: z.string().min(1, 'Department is required'),
  shift: z.enum(TAT_SHIFTS),
  instrumentId: z.string().optional(),
  delayReason: z.string().optional(),
}).superRefine((data, ctx) => {
  const received = new Date(data.sampleReceivedTime);
  const released = new Date(data.resultReleasedTime);
  if (Number.isNaN(received.getTime()) || Number.isNaN(released.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid date/time',
      path: ['resultReleasedTime'],
    });
    return;
  }
  if (released < received) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Result released time must be after sample received time',
      path: ['resultReleasedTime'],
    });
  }
});

export type TATRecordFormData = z.infer<typeof tatRecordFormSchema>;

export function emptyTATRecordForm(): TATRecordFormData {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return {
    sampleReceivedTime: local,
    resultReleasedTime: local,
    targetTatMinutes: 240,
    testType: '',
    priority: 'routine',
    department: 'Hematology',
    shift: 'morning',
    instrumentId: '',
    delayReason: '',
  };
}

export function deriveTATFields(form: TATRecordFormData) {
  const received = new Date(form.sampleReceivedTime);
  const released = new Date(form.resultReleasedTime);
  const calculatedTatMinutes = calculateTATMinutes(received, released);
  const status = getTATStatus(calculatedTatMinutes, form.targetTatMinutes);
  return { calculatedTatMinutes, status };
}
