import { z } from 'zod';

export const FILLABLE_PDF_STATUSES = ['draft', 'published', 'archived'] as const;
export type FillablePdfStatus = (typeof FILLABLE_PDF_STATUSES)[number];

export const FILLABLE_PDF_FIELD_TYPES = [
  'text',
  'number',
  'date',
  'time',
  'datetime',
  'dropdown',
  'yes_no',
  'checkbox',
  'multiselect',
  'textarea',
  'staff_identity',
  'staff_id',
  'auto_date',
  'auto_time',
] as const;

export type FillablePdfFieldType = (typeof FILLABLE_PDF_FIELD_TYPES)[number];

export const FILLABLE_PDF_FIELD_TYPE_LABELS: Record<FillablePdfFieldType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  time: 'Time',
  datetime: 'Date & Time',
  dropdown: 'Dropdown',
  yes_no: 'Yes / No',
  checkbox: 'Checkbox',
  multiselect: 'Multi Select',
  textarea: 'Long Text',
  staff_identity: 'Staff Identity',
  staff_id: 'Staff ID',
  auto_date: 'Auto Date',
  auto_time: 'Auto Time',
};

export const fillablePdfFieldConfigSchema = z.object({
  fontSize: z.number().optional(),
  multiline: z.boolean().optional(),
  autoFill: z.enum(['staff_name', 'staff_id', 'received_by']).optional(),
  readOnly: z.boolean().optional(),
});

export const fillablePdfFieldSchema = z.object({
  id: z.string().optional(),
  fieldKey: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(FILLABLE_PDF_FIELD_TYPES),
  pageNumber: z.number().int().min(1).default(1),
  posX: z.number().min(0).max(1),
  posY: z.number().min(0).max(1),
  width: z.number().min(0.01).max(1),
  height: z.number().min(0.01).max(1),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
  config: fillablePdfFieldConfigSchema.optional(),
});

export const fillablePdfTemplateSchema = z.object({
  title: z.string().min(1),
  formNumber: z.string().optional(),
  description: z.string().optional(),
  version: z.number().int().min(1).default(1),
  status: z.enum(FILLABLE_PDF_STATUSES).default('draft'),
  sourcePdfPath: z.string().min(1),
  sourcePdfName: z.string().optional(),
  pageCount: z.number().int().min(1).default(1),
  pageWidthPt: z.number().optional(),
  pageHeightPt: z.number().optional(),
  fields: z.array(fillablePdfFieldSchema),
});

export type FillablePdfFieldInput = z.infer<typeof fillablePdfFieldSchema>;
export type FillablePdfTemplateInput = z.infer<typeof fillablePdfTemplateSchema>;
export type FillablePdfFieldConfig = z.infer<typeof fillablePdfFieldConfigSchema>;

export const FILLABLE_FORMS_BUCKET = 'fillable-forms';
export const HEMA_001_TEMPLATE_ID = 'a1000000-0000-4000-8000-000000000001';
export const HEMA_001_BUNDLED_PDF = 'templates/Form-Hema-001-Routine-Tests-Form.pdf';

export function slugifyFillableFieldKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'field';
}

export function defaultOptionsForFillableType(type: FillablePdfFieldType): string[] | undefined {
  if (type === 'yes_no') return ['Yes', 'No'];
  if (type === 'dropdown' || type === 'multiselect') return ['Option 1', 'Option 2'];
  return undefined;
}
