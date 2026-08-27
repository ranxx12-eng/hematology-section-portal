'use client';

import { FILLABLE_PDF_FIELD_TYPE_LABELS, FILLABLE_PDF_FIELD_TYPES, slugifyFillableFieldKey } from '@/lib/fillable-pdf/schema';
import type { FillablePdfField, FillablePdfFieldType } from '@/types/modules';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface FieldToolboxProps {
  onAddField: (type: FillablePdfFieldType, label?: string) => void;
}

const QUICK_FIELDS = [
  'Patient Name',
  'Patient ID',
  'Clinic',
  'ESR Result',
  'Malaria Result',
  'Blood Film',
  'Received By',
];

export function FieldToolbox({ onAddField }: FieldToolboxProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-2">Field Types</p>
        <div className="grid grid-cols-1 gap-1">
          {FILLABLE_PDF_FIELD_TYPES.map((type) => (
            <Button
              key={type}
              variant="outline"
              size="sm"
              className="justify-start"
              onClick={() => onAddField(type, FILLABLE_PDF_FIELD_TYPE_LABELS[type])}
            >
              <Plus className="h-3.5 w-3.5 me-2" />
              {FILLABLE_PDF_FIELD_TYPE_LABELS[type]}
            </Button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Form-Hema-001 Quick Add</p>
        <div className="grid grid-cols-1 gap-1">
          {QUICK_FIELDS.map((label) => (
            <Button
              key={label}
              variant="ghost"
              size="sm"
              className="justify-start text-xs"
              onClick={() => onAddField(label.includes('Blood') ? 'textarea' : label === 'Received By' ? 'staff_identity' : 'text', label)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function createEmptyPdfField(
  type: FillablePdfFieldType,
  label: string,
  pageNumber: number,
  posX: number,
  posY: number,
): FillablePdfField {
  return {
    id: crypto.randomUUID(),
    fieldKey: slugifyFillableFieldKey(label),
    label,
    type,
    pageNumber,
    posX,
    posY,
    width: type === 'textarea' ? 0.35 : 0.18,
    height: type === 'textarea' ? 0.08 : 0.022,
    required: false,
    config: { fontSize: type === 'textarea' ? 8 : 9, multiline: type === 'textarea' },
  };
}
