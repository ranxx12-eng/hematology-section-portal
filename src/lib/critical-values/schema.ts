import { z } from 'zod';

export const CRITICAL_VALUE_TESTS = [
  'Platelet Count',
  'Hemoglobin',
  'WBC',
  'Neutrophils',
  'BLAST',
  'INR',
  'APTT',
  'D-Dimer',
  'Fibrinogen',
  'ESR',
  'PT',
  'HCT',
] as const;

export const CRITICAL_VALUE_DEPARTMENTS = [
  'ER',
  'ICU',
  'Ward',
  'OPD',
  'Hematology',
] as const;

export const CRITICAL_VALUE_ESCALATION_OPTIONS = [
  'ER Physician',
  'Medical Administration',
  'None',
] as const;

export type CriticalValueEscalation = (typeof CRITICAL_VALUE_ESCALATION_OPTIONS)[number];

export const CRITICAL_VALUE_READ_BACK_OPTIONS = ['Yes', 'No'] as const;

export type CriticalValueReadBack = (typeof CRITICAL_VALUE_READ_BACK_OPTIONS)[number];

export const criticalValueFormSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  patientName: z.string().min(1, 'Patient name is required'),
  patientAccNumber: z.string().min(1, 'Lab accession is required'),
  tests: z.array(z.string()).min(1, 'Select at least one test'),
  criticalValue: z.string().min(1, 'Critical value is required'),
  informedToDr: z.string().min(1, 'Informed to Dr is required'),
  drId: z.string().min(1, 'Dr ID is required'),
  verifyTime: z.string().min(1, 'Verify time is required'),
  informedTime: z.string().min(1, 'Informed time is required'),
  department: z.string().min(1, 'Department is required'),
  escalationTo: z.enum(CRITICAL_VALUE_ESCALATION_OPTIONS),
  readBack: z.enum(CRITICAL_VALUE_READ_BACK_OPTIONS, { message: 'Read Back is required' }),
  comment: z.string().optional(),
  initial: z.string().min(1, 'Initial is required'),
});

export type CriticalValueFormData = z.infer<typeof criticalValueFormSchema>;

export type CriticalValueFormDraft = Omit<CriticalValueFormData, 'readBack'> & {
  readBack?: CriticalValueReadBack;
};

export function emptyCriticalValueForm(initial: string): CriticalValueFormDraft {
  return {
    date: new Date().toISOString().slice(0, 10),
    patientId: '',
    patientName: '',
    patientAccNumber: '',
    tests: [],
    criticalValue: '',
    informedToDr: '',
    drId: '',
    verifyTime: '',
    informedTime: '',
    department: 'ER',
    escalationTo: 'None',
    comment: '',
    initial,
  };
}

export function displayEscalationTo(value: string | null | undefined): CriticalValueEscalation {
  if (value === 'ER Physician' || value === 'Medical Administration') return value;
  return 'None';
}

export function formatReadBack(value: boolean): CriticalValueReadBack {
  return value ? 'Yes' : 'No';
}

export function parseReadBack(value: CriticalValueReadBack): boolean {
  return value === 'Yes';
}

export function escalationToDbValue(value: CriticalValueEscalation): string | null {
  return value === 'None' ? null : value;
}

export function formatTestsList(tests: string[], separator = '; '): string {
  return tests.map((test) => test.trim()).filter(Boolean).join(separator);
}

export function normalizeCriticalValueTests(row: {
  test_names?: string[] | null;
  test_name?: string | null;
}): string[] {
  if (row.test_names?.length) {
    return row.test_names.map((test) => test.trim()).filter(Boolean);
  }
  if (row.test_name?.trim()) {
    return [row.test_name.trim()];
  }
  return [];
}
