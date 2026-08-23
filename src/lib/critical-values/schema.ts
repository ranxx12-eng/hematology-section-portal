import { z } from 'zod';

export const CRITICAL_VALUE_TESTS = [
  'Platelet Count',
  'Hemoglobin',
  'WBC',
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

export const CRITICAL_VALUE_TUBES = [
  'EDTA',
  'Sodium Citrate',
  'Plain Tube',
  'SST',
  'Heparin',
  'ESR Tube',
  'Slide',
  'Other',
] as const;

export const CRITICAL_VALUE_ESCALATION_OPTIONS = [
  'ER Physician',
  'Medical Administration',
  'None',
] as const;

export type CriticalValueEscalation = (typeof CRITICAL_VALUE_ESCALATION_OPTIONS)[number];

export const criticalValueFormSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  patientName: z.string().min(1, 'Patient name is required'),
  patientAccNumber: z.string().min(1, 'Lab accession is required'),
  test: z.string().min(1, 'Sample test is required'),
  sampleTube: z.string().min(1, 'Sample tube is required'),
  criticalValue: z.string().min(1, 'Critical value is required'),
  informedToDr: z.string().min(1, 'Informed to Dr is required'),
  drId: z.string().min(1, 'Dr ID is required'),
  verifyTime: z.string().min(1, 'Verify time is required'),
  informedTime: z.string().min(1, 'Informed time is required'),
  department: z.string().min(1, 'Department is required'),
  escalationTo: z.enum(CRITICAL_VALUE_ESCALATION_OPTIONS),
  comment: z.string().optional(),
  initial: z.string().min(1, 'Initial is required'),
});

export type CriticalValueFormData = z.infer<typeof criticalValueFormSchema>;

export function emptyCriticalValueForm(initial: string): CriticalValueFormData {
  return {
    date: new Date().toISOString().slice(0, 10),
    patientId: '',
    patientName: '',
    patientAccNumber: '',
    test: '',
    sampleTube: '',
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

export function escalationToDbValue(value: CriticalValueEscalation): string | null {
  return value === 'None' ? null : value;
}
