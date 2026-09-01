import type { Permission } from '@/lib/permissions/roles';

export function canViewPpmCalibration(can: (p: Permission) => boolean): boolean {
  return can('ppm_calibration.view');
}

export function canCreatePpmCalibration(can: (p: Permission) => boolean): boolean {
  return can('ppm_calibration.create');
}

export function canEditPpmCalibration(can: (p: Permission) => boolean): boolean {
  return can('ppm_calibration.edit');
}

export function canReviewPpmCalibration(can: (p: Permission) => boolean): boolean {
  return can('ppm_calibration.review');
}

export function canDeletePpmCalibration(can: (p: Permission) => boolean): boolean {
  return can('ppm_calibration.delete');
}

export function canViewEquipment(can: (p: Permission) => boolean): boolean {
  return can('equipment.view') || can('instruments.view');
}

export function canManageEquipment(can: (p: Permission) => boolean): boolean {
  return can('equipment.manage') || can('instruments.manage');
}
