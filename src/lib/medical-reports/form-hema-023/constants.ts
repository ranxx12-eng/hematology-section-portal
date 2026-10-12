export const FORM_HEMA_023_CODE = 'Form-Hema-023';
export const FORM_HEMA_023_TITLE = 'COAGULATION TEST (PT, APTT) MIXING STUDY WORKSHEET';
export const FORM_HEMA_023_DOCUMENT_NUMBER = 'HMG-SHF-LAB-HEMA-FORM-023';
export const FORM_HEMA_023_QID = 'HMG/SAH/QID/9174';
export const FORM_HEMA_023_FOOTER =
  'FORM-Hema-023 - COAGULATION TEST (PT, APTT) MIXING STUDY WORKSHEET';
export const FORM_HEMA_023_DEPARTMENT = 'Laboratory Department';
export const FORM_HEMA_023_SECTION = 'Hematology Section';

export const ROSNER_THRESHOLD = 15;
export const ROSNER_INHIBITOR_TEXT = 'Suggests presence of an inhibitor';
export const ROSNER_NEUTRAL_TEXT = 'Does not exceed the Form-Hema-023 inhibitor threshold.';
export const ROSNER_INCOMPLETE_TEXT = 'Incomplete';
export const ROSNER_CANNOT_CALCULATE_TEXT = 'Cannot Calculate';
export const ROSNER_FORMULA =
  '((Clotting time of 1:1 mix - Clotting time of NPP) / Clotting time of patient sample) x 100';
export const ROSNER_THRESHOLD_STATEMENT =
  "Rosner's index > 15 suggests presence of an inhibitor";

export const MIXING_STUDY_AUDIT_EVENTS = [
  'created',
  'draft_updated',
  'submitted',
  'changes_requested',
  'reviewed',
  'pdf_exported',
] as const;

export type MixingStudyAuditEvent = (typeof MIXING_STUDY_AUDIT_EVENTS)[number];

export const MIXING_STUDY_STATUSES = [
  'draft',
  'pending_review',
  'changes_requested',
  'reviewed',
] as const;

export type MixingStudyStatus = (typeof MIXING_STUDY_STATUSES)[number];

export const MIXING_STUDY_STATUS_LABELS: Record<MixingStudyStatus, string> = {
  draft: 'Draft',
  pending_review: 'Submitted / Pending Review',
  changes_requested: 'Changes Requested',
  reviewed: 'Reviewed',
};

export const MIXING_STUDY_TRANSITIONS = [
  ['draft', 'pending_review'],
  ['changes_requested', 'pending_review'],
  ['pending_review', 'reviewed'],
  ['pending_review', 'changes_requested'],
] as const;

export type MixingTestSelection = 'aptt' | 'pt' | 'both';
export type MixingTestType = 'aptt' | 'pt';

export function formHema023PdfFilename(studyNumber: string): string {
  if (!/^H023-\d{6}$/.test(studyNumber)) {
    throw new Error('Invalid study number');
  }
  return `${studyNumber}-Form-Hema-023.pdf`;
}

export function formatMixingStaffLine(role: 'Performed By' | 'Reviewed By', fullName: string, staffId: string | null | undefined): string {
  const name = fullName.trim() || '—';
  const id = staffId?.trim() ? staffId.trim() : 'Not assigned';
  return `${role}: ${name} · Staff ID: ${id}`;
}

export function testsForSelection(selection: MixingTestSelection): MixingTestType[] {
  if (selection === 'both') return ['aptt', 'pt'];
  return [selection];
}
