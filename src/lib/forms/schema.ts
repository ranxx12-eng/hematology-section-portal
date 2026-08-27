import { z } from 'zod';
import type { FormFieldType } from '@/types/modules';

export const FORM_STATUSES = ['draft', 'published', 'archived'] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export const FORM_CATEGORIES = [
  'Quality',
  'Safety',
  'Operations',
  'Training',
  'Maintenance',
  'Specimen Handling',
  'General',
] as const;

export const FORM_FIELD_TYPE_GROUPS = {
  basic: ['text', 'textarea', 'number', 'date', 'time', 'datetime', 'email', 'phone'] as const,
  selection: ['dropdown', 'radio', 'checkbox', 'yes_no', 'multiselect'] as const,
  laboratory: ['staff_selector', 'department_selector', 'instrument_selector', 'test_selector'] as const,
  structure: ['section_header', 'instructions', 'divider'] as const,
  advanced: ['file', 'signature', 'repeating_table'] as const,
} as const;

export const FORM_FIELD_TYPES = [
  ...FORM_FIELD_TYPE_GROUPS.basic,
  ...FORM_FIELD_TYPE_GROUPS.selection,
  ...FORM_FIELD_TYPE_GROUPS.laboratory,
  ...FORM_FIELD_TYPE_GROUPS.structure,
  ...FORM_FIELD_TYPE_GROUPS.advanced,
] as const;

export const FORM_FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: 'Short Text',
  textarea: 'Long Text',
  number: 'Number',
  date: 'Date',
  time: 'Time',
  datetime: 'Date & Time',
  email: 'Email',
  phone: 'Phone',
  dropdown: 'Dropdown',
  radio: 'Radio Buttons',
  checkbox: 'Checkbox',
  yes_no: 'Yes / No',
  multiselect: 'Multi Select',
  staff_selector: 'Staff Selector',
  department_selector: 'Department Selector',
  instrument_selector: 'Instrument Selector',
  test_selector: 'Test Selector',
  section_header: 'Section Header',
  instructions: 'Instructions',
  divider: 'Divider',
  file: 'File Upload',
  signature: 'Signature / Acknowledgement',
  repeating_table: 'Repeating Table',
};

export const repeatingTableColumnSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'date', 'time', 'dropdown']),
  options: z.array(z.string()).optional(),
});

export const formFieldConfigSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  decimals: z.boolean().optional(),
  unit: z.string().optional(),
  columns: z.array(repeatingTableColumnSchema).optional(),
  content: z.string().optional(),
  visible: z.boolean().optional(),
});

export const formFieldSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, 'Label is required'),
  fieldKey: z.string().optional(),
  type: z.enum(FORM_FIELD_TYPES),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  defaultValue: z.string().optional(),
  config: formFieldConfigSchema.optional(),
});

export const dynamicFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  formNumber: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  version: z.number().int().min(1).default(1),
  status: z.enum(FORM_STATUSES).default('draft'),
  isPublished: z.boolean().default(false),
  effectiveDate: z.string().optional(),
  reviewDate: z.string().optional(),
  fields: z.array(formFieldSchema),
});

export type DynamicFormInput = z.infer<typeof dynamicFormSchema>;
export type FormFieldInput = z.infer<typeof formFieldSchema>;
export type FormFieldConfig = z.infer<typeof formFieldConfigSchema>;
export type RepeatingTableColumn = z.infer<typeof repeatingTableColumnSchema>;

export function emptyDynamicFormInput(): DynamicFormInput {
  return {
    title: 'New Form',
    formNumber: '',
    description: '',
    category: 'General',
    version: 1,
    status: 'draft',
    isPublished: false,
    fields: [],
  };
}

export function slugifyFieldKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'field';
}

export function defaultOptionsForType(type: FormFieldType): string[] | undefined {
  if (type === 'yes_no') return ['Yes', 'No'];
  if (['dropdown', 'radio', 'multiselect'].includes(type)) return ['Option 1', 'Option 2'];
  return undefined;
}

export function isInputField(type: FormFieldType): boolean {
  return !['section_header', 'instructions', 'divider'].includes(type);
}

export type { FormFieldType };
