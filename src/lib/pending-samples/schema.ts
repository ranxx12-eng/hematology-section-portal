import { z } from 'zod';
import { REJECTED_TESTS } from '@/lib/sample-rejections/constants';

export const PENDING_SAMPLE_STATUSES = [
  'pending',
  'Awaiting Replacement Sample',
  'Replacement Sample Received',
  'Completed',
  'Discard Due',
  'processing',
  'on_hold',
] as const;

export const pendingSampleFormSchema = z.object({
  sourceType: z.enum(['tat', 'rejection']),
  patientId: z.string().min(1, 'Patient ID is required'),
  patientName: z.string().optional(),
  patientLabAccNumber: z.string().optional(),
  department: z.string().optional(),
  test: z.string().min(1, 'Test is required'),
  priority: z.enum(['stat', 'routine']),
  receivedTime: z.string().min(1, 'Received time is required'),
  currentStatus: z.string().min(1, 'Status is required'),
  isActive: z.boolean(),
  assignedStaffName: z.string().optional(),
  delayReason: z.string().optional(),
});

export type PendingSampleFormData = z.infer<typeof pendingSampleFormSchema>;

export function emptyPendingSampleForm(): PendingSampleFormData {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return {
    sourceType: 'tat',
    patientId: '',
    patientName: '',
    patientLabAccNumber: '',
    department: 'Hematology Section',
    test: '',
    priority: 'routine',
    receivedTime: local,
    currentStatus: 'pending',
    isActive: true,
    assignedStaffName: '',
    delayReason: '',
  };
}

export function calculateElapsedMinutes(receivedTime: string): number {
  const received = new Date(receivedTime).getTime();
  if (Number.isNaN(received)) return 0;
  return Math.max(0, Math.round((Date.now() - received) / 60000));
}

export { REJECTED_TESTS };
