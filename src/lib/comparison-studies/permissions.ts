import type { Permission } from '@/lib/permissions/roles';
import type { ComparisonStudy, ComparisonStudyStatus } from '@/types/comparison-study';

export function canViewComparisonStudies(can: (p: Permission) => boolean): boolean {
  return can('comparison.view');
}

export function canCreateComparisonStudies(can: (p: Permission) => boolean): boolean {
  return can('comparison.create');
}

export function canEditComparisonStudies(can: (p: Permission) => boolean): boolean {
  return can('comparison.edit');
}

export function canSubmitComparisonStudies(can: (p: Permission) => boolean): boolean {
  return can('comparison.submit');
}

export function canReviewComparisonStudies(can: (p: Permission) => boolean): boolean {
  return can('comparison.review');
}

export function canApproveComparisonStudies(can: (p: Permission) => boolean): boolean {
  return can('comparison.approve');
}

export function canExportComparisonStudies(can: (p: Permission) => boolean): boolean {
  return can('comparison.export');
}

export function canArchiveComparisonStudies(can: (p: Permission) => boolean): boolean {
  return can('comparison.archive');
}

export function canManageComparisonDefinitions(can: (p: Permission) => boolean): boolean {
  return can('comparison.manage_definitions');
}

export function isComparisonStudyEditable(study: Pick<ComparisonStudy, 'status'>): boolean {
  return study.status === 'draft' || study.status === 'returned';
}

export function isComparisonStudyReadOnly(study: Pick<ComparisonStudy, 'status'>): boolean {
  return study.status === 'approved' || study.status === 'archived' || study.status === 'rejected';
}

export function filterStudiesByTab<T extends { status: ComparisonStudyStatus; overallResult?: ComparisonStudy['overallResult'] }>(
  studies: T[],
  tab: string,
): T[] {
  switch (tab) {
    case 'drafts':
      return studies.filter((s) => s.status === 'draft');
    case 'pending_review':
      return studies.filter((s) => s.status === 'pending_review' || s.status === 'submitted');
    case 'pending_approval':
      return studies.filter((s) => s.status === 'pending_approval');
    case 'approved':
      return studies.filter((s) => s.status === 'approved');
    case 'failed':
      return studies.filter((s) => s.overallResult === 'not_acceptable');
    case 'archived':
      return studies.filter((s) => s.status === 'archived');
    default:
      return studies.filter((s) => s.status !== 'archived');
  }
}

export function formatComparisonStatusLabel(status: ComparisonStudyStatus): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
