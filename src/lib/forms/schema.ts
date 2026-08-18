import { z } from 'zod';
import type { FormFieldType } from '@/types/modules';

export const FORM_FIELD_TYPES = [
  'text', 'number', 'date', 'time', 'dropdown', 'radio', 'checkbox',
  'file', 'signature', 'email', 'phone', 'multiselect',
] as const;

export const formFieldSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1, 'Label is required'),
  type: z.enum(FORM_FIELD_TYPES),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
});

export const dynamicFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  isPublished: z.boolean().default(false),
  fields: z.array(formFieldSchema),
});

export type DynamicFormInput = z.infer<typeof dynamicFormSchema>;

export function emptyDynamicFormInput(): DynamicFormInput {
  return {
    title: 'New Form',
    description: '',
    isPublished: false,
    fields: [],
  };
}

export type { FormFieldType };
