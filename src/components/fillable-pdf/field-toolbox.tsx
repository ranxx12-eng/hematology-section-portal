'use client';

import { FILLABLE_PDF_FIELD_TYPE_LABELS, slugifyFillableFieldKey } from '@/lib/fillable-pdf/schema';
import type { FillablePdfField, FillablePdfFieldType } from '@/types/modules';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface FieldToolboxProps {
  onAddField: (type: FillablePdfFieldType, label?: string) => void;
}

const TOOLBOX_FIELDS: { type: FillablePdfFieldType; label: string }[] = [
  { type: 'text', label: 'Text' },
  { type: 'number', label: 'Number' },
  { type: 'date', label: 'Date' },
  { type: 'time', label: 'Time' },
  { type: 'dropdown', label: 'Dropdown' },
  { type: 'yes_no', label: 'Yes / No' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'textarea', label: 'Long Text' },
  { type: 'staff_identity', label: 'Staff Name' },
  { type: 'staff_id', label: 'Staff ID' },
  { type: 'auto_date', label: 'Auto Date' },
  { type: 'auto_time', label: 'Auto Time' },
];

const MORE_FIELDS: { type: FillablePdfFieldType; label: string }[] = [
  { type: 'datetime', label: 'Date & Time' },
  { type: 'multiselect', label: 'Multi Select' },
];

export function FieldToolbox({ onAddField }: FieldToolboxProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-2">Add Field</p>
        <div className="grid grid-cols-1 gap-1">
          {TOOLBOX_FIELDS.map(({ type, label }) => (
            <Button
              key={type}
              variant="outline"
              size="sm"
              className="justify-start"
              onClick={() => onAddField(type, label)}
            >
              <Plus className="h-3.5 w-3.5 me-2" />
              {label}
            </Button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">More types</p>
        <div className="grid grid-cols-1 gap-1">
          {MORE_FIELDS.map(({ type, label }) => (
            <Button
              key={type}
              variant="ghost"
              size="sm"
              className="justify-start text-xs"
              onClick={() => onAddField(type, label)}
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
