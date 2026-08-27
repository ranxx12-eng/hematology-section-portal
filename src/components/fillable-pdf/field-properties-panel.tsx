'use client';

import { useState } from 'react';
import type { FillablePdfField } from '@/types/modules';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FILLABLE_PDF_FIELD_TYPES, FILLABLE_PDF_FIELD_TYPE_LABELS } from '@/lib/fillable-pdf/schema';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';

interface FieldPropertiesPanelProps {
  field: FillablePdfField | null;
  onChange: (field: FillablePdfField) => void;
  onDelete: (fieldId: string) => void;
}

export function FieldPropertiesPanel({ field, onChange, onDelete }: FieldPropertiesPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  if (!field) {
    return <p className="text-sm text-muted-foreground">Select a field to edit its properties.</p>;
  }

  const patch = (updates: Partial<FillablePdfField>) => onChange({ ...field, ...updates });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-medium text-sm">Field Properties</p>
        <Button size="icon" variant="ghost" onClick={() => onDelete(field.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <div><Label>Label</Label><Input value={field.label} onChange={(e) => patch({ label: e.target.value })} /></div>
      <div><Label>Field Key</Label><Input value={field.fieldKey} onChange={(e) => patch({ fieldKey: e.target.value })} /></div>
      <div>
        <Label>Type</Label>
        <Select value={field.type} onValueChange={(type) => patch({ type: type as FillablePdfField['type'] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {FILLABLE_PDF_FIELD_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{FILLABLE_PDF_FIELD_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Placeholder</Label><Input value={field.placeholder ?? ''} onChange={(e) => patch({ placeholder: e.target.value })} /></div>
      <div className="flex items-center justify-between">
        <Label>Required</Label>
        <Switch checked={field.required} onCheckedChange={(required) => patch({ required })} />
      </div>
      <div><Label>Font Size</Label><Input type="number" min={6} max={14} value={field.config?.fontSize ?? 9} onChange={(e) => patch({ config: { ...field.config, fontSize: Number(e.target.value) } })} /></div>

      <div>
        <button
          type="button"
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          {advancedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Advanced (coordinates)
        </button>
        {advancedOpen && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div><Label>X</Label><Input type="number" step="0.001" min={0} max={1} value={field.posX} onChange={(e) => patch({ posX: Number(e.target.value) })} /></div>
            <div><Label>Y</Label><Input type="number" step="0.001" min={0} max={1} value={field.posY} onChange={(e) => patch({ posY: Number(e.target.value) })} /></div>
            <div><Label>Width</Label><Input type="number" step="0.001" min={0.01} max={1} value={field.width} onChange={(e) => patch({ width: Number(e.target.value) })} /></div>
            <div><Label>Height</Label><Input type="number" step="0.001" min={0.01} max={1} value={field.height} onChange={(e) => patch({ height: Number(e.target.value) })} /></div>
          </div>
        )}
      </div>
    </div>
  );
}
