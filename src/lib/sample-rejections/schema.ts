import { z } from 'zod';
import { REJECTION_REASONS } from './constants';

export const sampleRejectionFormSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  patientName: z.string().min(1, 'Patient name is required'),
  patientLabAccNumber: z.string().min(1, 'Patient Lab ACC# is required'),
  department: z.string().min(1, 'Department is required'),
  rejectionDate: z.string().min(1, 'Rejection date is required'),
  rejectionTime: z.string().min(1, 'Rejection time is required'),
  rejectedTests: z.array(z.string()).min(1, 'Select at least one rejected test'),
  rejectedTube: z.string().min(1, 'Sample tube is required'),
  rejectionReasons: z.array(z.string()).min(1, 'Select at least one rejection reason'),
  otherRejectionReason: z.string().optional(),
  informedNurseName: z.string().min(1, 'Informed nurse name is required'),
  nurseId: z.string().min(1, 'Nurse ID is required'),
  nurseNotificationDate: z.string().min(1, 'Nurse notification date is required'),
  nurseNotificationTime: z.string().min(1, 'Nurse notification time is required'),
  doctorNotificationRequired: z.boolean(),
  doctorName: z.string().optional(),
  doctorId: z.string().optional(),
  doctorNotificationDate: z.string().optional(),
  doctorNotificationTime: z.string().optional(),
  comments: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.rejectionReasons.includes('Other') && !data.otherRejectionReason?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Please specify other rejection reason',
      path: ['otherRejectionReason'],
    });
  }
  if (data.doctorNotificationRequired) {
    if (!data.doctorName?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Doctor name is required', path: ['doctorName'] });
    if (!data.doctorId?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Doctor ID is required', path: ['doctorId'] });
    if (!data.doctorNotificationDate) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Doctor notification date is required', path: ['doctorNotificationDate'] });
    if (!data.doctorNotificationTime) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Doctor notification time is required', path: ['doctorNotificationTime'] });
  }
});

export type SampleRejectionFormData = z.infer<typeof sampleRejectionFormSchema>;

export function emptySampleRejectionForm(): SampleRejectionFormData {
  const now = new Date();
  return {
    patientId: '',
    patientName: '',
    patientLabAccNumber: '',
    department: '',
    rejectionDate: now.toISOString().slice(0, 10),
    rejectionTime: now.toTimeString().slice(0, 5),
    rejectedTests: [],
    rejectedTube: '',
    rejectionReasons: [],
    otherRejectionReason: '',
    informedNurseName: '',
    nurseId: '',
    nurseNotificationDate: now.toISOString().slice(0, 10),
    nurseNotificationTime: now.toTimeString().slice(0, 5),
    doctorNotificationRequired: false,
    doctorName: '',
    doctorId: '',
    doctorNotificationDate: '',
    doctorNotificationTime: '',
    comments: '',
  };
}

export function isOtherReasonSelected(reasons: string[]): boolean {
  return reasons.some((r) => r === 'Other' || r === REJECTION_REASONS[REJECTION_REASONS.length - 1]);
}
