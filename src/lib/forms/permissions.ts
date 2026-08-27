import type { Permission } from '@/lib/permissions/roles';

export type FormPermissionChecker = (permission: Permission) => boolean;

/** Design interface: create/edit fields, save draft, preview, duplicate. */
export function canBuildForms(can: FormPermissionChecker): boolean {
  return can('forms.build') || can('forms.manage');
}

/** Publish, unpublish, archive lifecycle actions. */
export function canPublishForms(can: FormPermissionChecker): boolean {
  return can('forms.publish') || can('forms.manage');
}

/** View all submissions, export CSV, print/PDF responses. */
export function canManageFormResponses(can: FormPermissionChecker): boolean {
  return can('forms.manage_responses') || can('forms.manage');
}

/** Submit answers on a published form. */
export function canSubmitForms(can: FormPermissionChecker): boolean {
  return can('forms.submit') || can('forms.manage');
}

/** View published forms (staff list / fill screen). */
export function canViewPublishedForms(can: FormPermissionChecker): boolean {
  return can('forms.view') || canBuildForms(can) || canSubmitForms(can);
}

/** Form Builder design route — not for routine fill-only staff. */
export function canAccessFormBuilder(can: FormPermissionChecker): boolean {
  return canBuildForms(can);
}

/** Electronic Forms staff list (published web forms). */
export function canAccessElectronicForms(can: FormPermissionChecker): boolean {
  return canViewPublishedForms(can);
}

/** Fillable PDF template design route. */
export function canAccessFillableFormDesigner(can: FormPermissionChecker): boolean {
  return canBuildForms(can);
}

/** Fillable PDF template library (staff view published; builders see all). */
export function canAccessFillableForms(can: FormPermissionChecker): boolean {
  return canViewPublishedForms(can) || canBuildForms(can);
}

/** View completed submission archive for fillable PDF forms. */
export function canAccessFillableFormArchive(can: FormPermissionChecker): boolean {
  return canManageFormResponses(can) || canBuildForms(can) || canPublishForms(can);
}
