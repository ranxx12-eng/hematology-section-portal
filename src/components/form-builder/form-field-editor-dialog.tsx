'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FORM_CATEGORIES,
  FORM_FIELD_TYPE_GROUPS,
  FORM_FIELD_TYPE_LABELS,
  defaultOptionsForType,
  slugifyFieldKey,
  type FormFieldInput,
} from '@/lib/forms/schema';
import type { FormField, FormFieldType } from '@/types/modules';
import { generateId } from '@/lib/utils';

interface FormFieldEditorDialogProps {
  open: boolean;
  field: FormField | null;
  onOpenChange: (open: boolean) => void;
  onSave: (field: FormField) => void;
}

export function FormFieldEditorDialog({ open, field, onOpenChange, onSave }: FormFieldEditorDialogProps) {
  const [draft, setDraft] = useState<FormField | null>(field);

  useEffect(() => {
    setDraft(field);
  }, [field]);

  if (!draft) return null;

  const optionsText = (draft.options ?? []).join('\n');
  const columnsText = (draft.config?.columns ?? [])
    .map((column) => `${column.label}|${column.key}|${column.type}`)
    .join('\n');

  const save = () => {
    onSave({
      ...draft,
      fieldKey: draft.fieldKey?.trim() || slugifyFieldKey(draft.label),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{field?.label ? 'Edit Field' : 'Add Field'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>Label</Label><Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></div>
            <div><Label>Internal Key</Label><Input value={draft.fieldKey ?? ''} onChange={(e) => setDraft({ ...draft, fieldKey: e.target.value })} /></div>
          </div>
          <div><Label>Field Type</Label>
            <Select value={draft.type} onValueChange={(type) => setDraft({
              ...draft,
              type: type as FormFieldType,
              options: defaultOptionsForType(type as FormFieldType),
            })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(FORM_FIELD_TYPE_GROUPS).map(([group, types]) => (
                  <div key={group}>
                    <p className="px-2 py-1 text-xs font-semibold text-muted-foreground capitalize">{group}</p>
                    {types.map((type) => (
                      <SelectItem key={type} value={type}>{FORM_FIELD_TYPE_LABELS[type]}</SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>Placeholder</Label><Input value={draft.placeholder ?? ''} onChange={(e) => setDraft({ ...draft, placeholder: e.target.value })} /></div>
            <div><Label>Default Value</Label><Input value={draft.defaultValue ?? ''} onChange={(e) => setDraft({ ...draft, defaultValue: e.target.value })} /></div>
          </div>
          <div><Label>Help Text</Label><Textarea value={draft.helpText ?? ''} onChange={(e) => setDraft({ ...draft, helpText: e.target.value })} rows={2} /></div>
          <div className="flex items-center gap-2"><Switch checked={draft.required} onCheckedChange={(required) => setDraft({ ...draft, required })} /><Label>Required</Label></div>

          {['dropdown', 'radio', 'multiselect', 'yes_no'].includes(draft.type) && (
            <div>
              <Label>Options (one per line)</Label>
              <Textarea
                value={optionsText}
                rows={4}
                onChange={(e) => setDraft({ ...draft, options: e.target.value.split('\n').map((v) => v.trim()).filter(Boolean) })}
              />
            </div>
          )}

          {draft.type === 'number' && (
            <div className="grid md:grid-cols-3 gap-3">
              <div><Label>Min</Label><Input type="number" value={draft.config?.min ?? ''} onChange={(e) => setDraft({ ...draft, config: { ...draft.config, min: Number(e.target.value) } })} /></div>
              <div><Label>Max</Label><Input type="number" value={draft.config?.max ?? ''} onChange={(e) => setDraft({ ...draft, config: { ...draft.config, max: Number(e.target.value) } })} /></div>
              <div><Label>Unit</Label><Input value={draft.config?.unit ?? ''} onChange={(e) => setDraft({ ...draft, config: { ...draft.config, unit: e.target.value } })} /></div>
            </div>
          )}

          {['section_header', 'instructions'].includes(draft.type) && (
            <div><Label>Content</Label><Textarea value={draft.config?.content ?? ''} onChange={(e) => setDraft({ ...draft, config: { ...draft.config, content: e.target.value } })} rows={3} /></div>
          )}

          {draft.type === 'repeating_table' && (
            <div>
              <Label>Columns (Label|key|type per line)</Label>
              <Textarea
                value={columnsText}
                rows={5}
                onChange={(e) => setDraft({
                  ...draft,
                  config: {
                    ...draft.config,
                    columns: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
                      const [label, key, type = 'text'] = line.split('|');
                      return { label: label.trim(), key: key.trim(), type: type.trim() as 'text' };
                    }),
                  },
                })}
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save}>Save Field</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function createEmptyField(type: FormFieldType = 'text'): FormField {
  return {
    id: generateId(),
    label: 'New Field',
    fieldKey: slugifyFieldKey('new_field'),
    type,
    required: false,
    options: defaultOptionsForType(type),
  };
}

export type { FormFieldInput };
