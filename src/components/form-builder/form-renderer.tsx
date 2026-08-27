'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchInstruments } from '@/lib/clinical/instruments';
import { fetchStaffIdentityMap } from '@/lib/clinical/staff-profiles';
import { CRITICAL_VALUE_TESTS } from '@/lib/critical-values/schema';
import { REJECTION_DEPARTMENTS } from '@/lib/sample-rejections/constants';
import { formatStaffOptionLabel } from '@/lib/staff/identity';
import { isInputField } from '@/lib/forms/schema';
import type { FormField, FormSnapshot } from '@/types/modules';

interface FormRendererProps {
  fields: FormField[];
  values: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
  readOnly?: boolean;
  preview?: boolean;
}

export function FormRenderer({ fields, values, onChange, readOnly = false, preview = false }: FormRendererProps) {
  const [staffOptions, setStaffOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [instrumentOptions, setInstrumentOptions] = useState<string[]>([]);

  useEffect(() => {
    void fetchStaffIdentityMap().then((map) => {
      setStaffOptions(
        Object.entries(map).map(([id, staff]) => ({
          id,
          label: formatStaffOptionLabel(staff.fullName, staff.staffId),
        })),
      );
    });
    void fetchInstruments().then((result) => {
      setInstrumentOptions(result.data.map((item) => item.name).filter(Boolean));
    });
  }, []);

  const visibleFields = useMemo(
    () => fields.filter((field) => field.config?.visible !== false),
    [fields],
  );

  return (
    <div className="space-y-5">
      {visibleFields.map((field) => (
        <FormFieldRenderer
          key={field.id}
          field={field}
          value={values[field.id]}
          onChange={(value) => onChange(field.id, value)}
          readOnly={readOnly}
          preview={preview}
          staffOptions={staffOptions}
          instrumentOptions={instrumentOptions}
        />
      ))}
    </div>
  );
}

interface FormFieldRendererProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
  preview?: boolean;
  staffOptions: Array<{ id: string; label: string }>;
  instrumentOptions: string[];
}

function FormFieldRenderer({
  field,
  value,
  onChange,
  readOnly,
  preview,
  staffOptions,
  instrumentOptions,
}: FormFieldRendererProps) {
  if (field.type === 'section_header') {
    return (
      <div>
        <h3 className="text-base font-semibold text-primary">{field.label}</h3>
        {field.config?.content && <p className="text-sm text-muted-foreground mt-1">{field.config.content}</p>}
      </div>
    );
  }

  if (field.type === 'instructions') {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">{field.label}</p>
        <p>{field.config?.content ?? field.helpText ?? field.label}</p>
      </div>
    );
  }

  if (field.type === 'divider') {
    return <hr className="border-border" />;
  }

  const disabled = readOnly || preview;
  const stringValue = value == null ? '' : String(value);

  return (
    <div className="space-y-1.5">
      <Label>
        {field.label}
        {field.required && <span className="text-destructive ms-1">*</span>}
      </Label>
      {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}

      {field.type === 'textarea' && (
        <Textarea
          value={stringValue}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {['text', 'email', 'phone', 'date', 'time', 'datetime', 'number'].includes(field.type) && (
        <Input
          type={field.type === 'number' ? 'number' : field.type === 'datetime' ? 'datetime-local' : field.type}
          value={stringValue}
          placeholder={field.placeholder}
          min={field.config?.min}
          max={field.config?.max}
          step={field.config?.decimals ? 'any' : field.type === 'number' ? '1' : undefined}
          disabled={disabled}
          onChange={(e) => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
        />
      )}

      {field.type === 'dropdown' && (
        <Select value={stringValue || undefined} disabled={disabled} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder={field.placeholder ?? 'Select...'} /></SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === 'staff_selector' && (
        <Select value={stringValue || undefined} disabled={disabled} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
          <SelectContent>
            {staffOptions.map((option) => (
              <SelectItem key={option.id} value={option.label}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === 'department_selector' && (
        <Select value={stringValue || undefined} disabled={disabled} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
          <SelectContent>
            {REJECTION_DEPARTMENTS.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === 'instrument_selector' && (
        <Select value={stringValue || undefined} disabled={disabled} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Select instrument" /></SelectTrigger>
          <SelectContent>
            {instrumentOptions.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === 'test_selector' && (
        <Select value={stringValue || undefined} disabled={disabled} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Select test" /></SelectTrigger>
          <SelectContent>
            {CRITICAL_VALUE_TESTS.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {(field.type === 'radio' || field.type === 'yes_no') && (
        <div className="space-y-2">
          {(field.options ?? ['Yes', 'No']).map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={field.id}
                value={option}
                checked={stringValue === option}
                disabled={disabled}
                onChange={() => onChange(option)}
              />
              {option}
            </label>
          ))}
        </div>
      )}

      {field.type === 'checkbox' && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={Boolean(value)}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(Boolean(checked))}
          />
          {field.placeholder ?? 'Checked'}
        </label>
      )}

      {field.type === 'multiselect' && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          {(field.options ?? []).map((option) => {
            const selected = Array.isArray(value) ? value.includes(option) : false;
            return (
              <label key={option} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected}
                  disabled={disabled}
                  onCheckedChange={(checked) => {
                    const current = Array.isArray(value) ? value : [];
                    onChange(checked ? [...current, option] : current.filter((item) => item !== option));
                  }}
                />
                {option}
              </label>
            );
          })}
        </div>
      )}

      {field.type === 'signature' && (
        <div className="space-y-2">
          <Input
            value={stringValue}
            placeholder="Type full name to acknowledge"
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Electronic acknowledgement by typed name.</p>
        </div>
      )}

      {field.type === 'file' && !readOnly && !preview && (
        <Input type="file" disabled={disabled} onChange={(e) => onChange(e.target.files?.[0]?.name ?? '')} />
      )}

      {field.type === 'file' && (readOnly || preview) && (
        <p className="text-sm">{stringValue || '—'}</p>
      )}

      {field.type === 'repeating_table' && (
        <RepeatingTableField field={field} value={value} onChange={onChange} disabled={disabled} />
      )}

      {field.config?.unit && field.type === 'number' && (
        <p className="text-xs text-muted-foreground">Unit: {field.config.unit}</p>
      )}
    </div>
  );
}

function RepeatingTableField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}) {
  const columns = field.config?.columns ?? [
    { key: 'col1', label: 'Column 1', type: 'text' as const },
  ];
  const rows = Array.isArray(value) ? (value as Record<string, string>[]) : [{}];

  const updateCell = (rowIndex: number, key: string, cellValue: string) => {
    const next = rows.map((row, index) => (index === rowIndex ? { ...row, [key]: cellValue } : row));
    onChange(next);
  };

  const addRow = () => onChange([...rows, {}]);
  const removeRow = (index: number) => onChange(rows.filter((_, i) => i !== index));

  return (
    <div className="space-y-3 overflow-x-auto">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-2">
          {columns.map((column) => (
            <div key={column.key}>
              <Label className="text-xs">{column.label}</Label>
              <Input
                value={row[column.key] ?? ''}
                disabled={disabled}
                onChange={(e) => updateCell(rowIndex, column.key, e.target.value)}
              />
            </div>
          ))}
          {!disabled && rows.length > 1 && (
            <button type="button" className="text-xs text-destructive md:col-span-2 text-start" onClick={() => removeRow(rowIndex)}>
              Remove row
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button type="button" className="text-sm text-primary" onClick={addRow}>+ Add row</button>
      )}
    </div>
  );
}

export function validateFormAnswers(fields: FormField[], values: Record<string, unknown>): string | null {
  for (const field of fields) {
    if (!field.required || !isInputField(field.type)) continue;
    const value = values[field.id];
    if (field.type === 'multiselect') {
      if (!Array.isArray(value) || value.length === 0) return `${field.label} is required.`;
      continue;
    }
    if (field.type === 'checkbox') {
      if (!value) return `${field.label} is required.`;
      continue;
    }
    if (field.type === 'repeating_table') {
      if (!Array.isArray(value) || value.length === 0) return `${field.label} is required.`;
      continue;
    }
    if (value == null || String(value).trim() === '') return `${field.label} is required.`;
  }
  return null;
}

export function formatAnswerValue(value: unknown): string {
  if (value == null) return '—';
  if (Array.isArray(value)) return value.join('; ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function getResponseFields(response: { formSnapshot?: FormSnapshot }, form: { fields: FormField[] }): FormField[] {
  return response.formSnapshot?.fields ?? form.fields;
}
