import type { FillablePdfField } from '@/types/modules';

export interface StaffAutoFillContext {
  fullName: string;
  staffId: string | null;
  now?: Date;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatTime(d: Date): string {
  return d.toTimeString().slice(0, 5);
}

export function resolveAutoFieldValue(
  field: FillablePdfField,
  context: StaffAutoFillContext,
  existing?: Record<string, unknown>,
): string {
  const now = context.now ?? new Date();
  const key = field.fieldKey;

  if (existing?.[key] != null && String(existing[key]).trim()) {
    return String(existing[key]);
  }

  switch (field.type) {
    case 'staff_identity':
      return context.fullName;
    case 'staff_id':
      return context.staffId ?? '';
    case 'auto_date':
      return formatDate(now);
    case 'auto_time':
      return formatTime(now);
    default:
      return '';
  }
}

export function buildInitialFillValues(
  fields: FillablePdfField[],
  context: StaffAutoFillContext,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    if (['staff_identity', 'staff_id', 'auto_date', 'auto_time'].includes(field.type)) {
      values[field.fieldKey] = resolveAutoFieldValue(field, context);
    } else if (field.defaultValue) {
      values[field.fieldKey] = field.defaultValue;
    } else {
      values[field.fieldKey] = '';
    }
  }
  return values;
}

export function formatFieldDisplayValue(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export function validateFillablePdfAnswers(
  fields: FillablePdfField[],
  answers: Record<string, unknown>,
): string | null {
  for (const field of fields) {
    if (!field.required) continue;
    const value = answers[field.fieldKey];
    if (value == null || String(value).trim() === '') {
      return `${field.label} is required.`;
    }
  }
  return null;
}
