import { generateId } from '@/lib/utils';
import type { Employee, Notification, PendingSample, SampleRejection, SystemSettings } from '@/types';
import type { SampleRejectionFormData } from './schema';

export interface StaffContext {
  userId: string;
  fullName: string;
  staffId: string | null;
}

export function resolveStaffContext(userId: string, fullName: string, employees: Employee[]): StaffContext {
  const employee = employees.find((e) => e.email.includes(fullName.split(' ')[0]?.toLowerCase() ?? '')) ?? employees[0];
  return {
    userId,
    fullName,
    staffId: employee?.employeeId ?? null,
  };
}

export function calculateDiscardDueAt(rejectionDate: string, rejectionTime: string, retentionDays: number): string {
  const base = new Date(`${rejectionDate}T${rejectionTime}:00`);
  base.setDate(base.getDate() + retentionDays);
  return base.toISOString();
}

export function calculateElapsedMinutes(rejectionDate: string, rejectionTime: string): number {
  const start = new Date(`${rejectionDate}T${rejectionTime}:00`).getTime();
  return Math.max(0, Math.round((Date.now() - start) / 60000));
}

export function createPendingSampleFromRejection(rejection: SampleRejection, staff: StaffContext): PendingSample {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    sourceType: 'rejection',
    sampleRejectionId: rejection.id,
    patientId: rejection.patientId,
    patientName: rejection.patientName,
    patientLabAccNumber: rejection.patientLabAccNumber,
    department: rejection.department,
    rejectedTests: rejection.rejectedTests,
    rejectedTube: rejection.rejectedTube,
    rejectionReasons: rejection.rejectionReasons,
    rejectionDate: rejection.rejectionDate,
    rejectionTime: rejection.rejectionTime,
    test: rejection.rejectedTests.join(', '),
    priority: 'routine',
    receivedTime: `${rejection.rejectionDate}T${rejection.rejectionTime}:00`,
    elapsedMinutes: calculateElapsedMinutes(rejection.rejectionDate, rejection.rejectionTime),
    assignedStaffId: staff.userId,
    assignedStaffName: staff.fullName,
    currentStatus: 'Awaiting Replacement Sample',
    replacementSampleStatus: 'Awaiting Replacement Sample',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildSampleRejection(
  form: SampleRejectionFormData,
  staff: StaffContext,
  retentionDays: number,
  existingId?: string,
): SampleRejection {
  const now = new Date();
  const nowIso = now.toISOString();
  const recordCreatedDate = now.toISOString().slice(0, 10);
  const recordCreatedTime = now.toTimeString().slice(0, 5);

  return {
    id: existingId ?? generateId(),
    patientId: form.patientId,
    patientName: form.patientName,
    patientLabAccNumber: form.patientLabAccNumber,
    department: form.department,
    rejectionDate: form.rejectionDate,
    rejectionTime: form.rejectionTime,
    rejectedTests: form.rejectedTests,
    rejectedTube: form.rejectedTube,
    rejectionReasons: form.rejectionReasons,
    otherRejectionReason: form.otherRejectionReason?.trim() || undefined,
    informedNurseName: form.informedNurseName,
    nurseId: form.nurseId,
    nurseNotificationDate: form.nurseNotificationDate,
    nurseNotificationTime: form.nurseNotificationTime,
    doctorNotificationRequired: form.doctorNotificationRequired,
    doctorName: form.doctorNotificationRequired ? form.doctorName : undefined,
    doctorId: form.doctorNotificationRequired ? form.doctorId : undefined,
    doctorNotificationDate: form.doctorNotificationRequired ? form.doctorNotificationDate : undefined,
    doctorNotificationTime: form.doctorNotificationRequired ? form.doctorNotificationTime : undefined,
    createdByUserId: staff.userId,
    createdByStaffName: staff.fullName,
    createdByStaffId: staff.staffId ?? '',
    recordCreatedDate,
    recordCreatedTime,
    supervisorReviewStatus: 'pending_supervisor_review',
    replacementSampleStatus: 'Awaiting Replacement Sample',
    discardDueAt: calculateDiscardDueAt(form.rejectionDate, form.rejectionTime, retentionDays),
    discardStatus: 'not_due',
    comments: form.comments?.trim() || undefined,
    createdAt: existingId ? nowIso : nowIso,
    updatedAt: nowIso,
  };
}

export function syncDiscardDueStatuses(
  rejections: SampleRejection[],
  pendingSamples: PendingSample[],
  employees: Employee[],
  notifications: Notification[],
  retentionDays: number,
): void {
  const now = Date.now();
  rejections.forEach((rejection) => {
    if (rejection.replacementSampleStatus === 'Completed' || rejection.replacementSampleStatus === 'Discarded') return;
    const dueAt = new Date(rejection.discardDueAt).getTime();
    if (now >= dueAt && rejection.discardStatus !== 'discarded') {
      rejection.discardStatus = 'discard_due';
      rejection.replacementSampleStatus = rejection.replacementSampleStatus === 'Awaiting Replacement Sample'
        ? 'Awaiting Replacement Sample'
        : rejection.replacementSampleStatus;

      const nightShiftEmployees = employees.filter((e) => e.shift === 'night' && e.isActive);
      nightShiftEmployees.forEach((emp) => {
        const exists = notifications.some(
          (n) => n.type === 'sample_discard_due' && n.link === rejection.id && !n.isRead
        );
        if (!exists) {
          notifications.unshift({
            id: generateId(),
            userId: emp.id,
            type: 'sample_discard_due',
            title: 'Sample Due for Discard',
            message: `ACC# ${rejection.patientLabAccNumber} | ${rejection.rejectedTests.join(', ')} | ${rejection.rejectedTube} | Due: ${new Date(rejection.discardDueAt).toLocaleString()}`,
            isRead: false,
            link: rejection.id,
            createdAt: new Date().toISOString(),
          });
        }
      });

      const pending = pendingSamples.find((p) => p.sampleRejectionId === rejection.id && p.isActive);
      if (pending) pending.currentStatus = 'Discard Due';
    }
  });

  rejections.forEach((rejection) => {
    if (rejection.discardStatus === 'not_due') {
      const dueAt = new Date(rejection.discardDueAt).getTime();
      if (Date.now() < dueAt) {
        rejection.discardDueAt = calculateDiscardDueAt(rejection.rejectionDate, rejection.rejectionTime, retentionDays);
      }
    }
  });
}

export function getRetentionDays(settings: SystemSettings): number {
  return settings.rejectedSampleRetentionDays ?? 3;
}
