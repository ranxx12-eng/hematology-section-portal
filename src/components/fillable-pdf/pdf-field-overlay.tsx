'use client';

import { normalizedToPixels } from '@/lib/fillable-pdf/coordinates';
import type { FillablePdfField } from '@/types/modules';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PdfFieldOverlayProps {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  fields: FillablePdfField[];
  mode: 'design' | 'fill' | 'preview';
  values: Record<string, string>;
  selectedFieldId?: string | null;
  onSelectField?: (fieldId: string | null) => void;
  onFieldChange?: (fieldKey: string, value: string) => void;
  onFieldMove?: (fieldId: string, patch: Partial<Pick<FillablePdfField, 'posX' | 'posY' | 'width' | 'height'>>) => void;
}

function FieldInput({
  field,
  value,
  readOnly,
  onChange,
}: {
  field: FillablePdfField;
  value: string;
  readOnly: boolean;
  onChange?: (value: string) => void;
}) {
  const common = 'h-full w-full border-0 bg-transparent px-1 py-0 text-[11px] shadow-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-sm';

  if (field.type === 'textarea') {
    return (
      <Textarea
        className={`${common} resize-none min-h-0 leading-tight`}
        value={value}
        readOnly={readOnly}
        placeholder={field.placeholder}
        onChange={(e) => onChange?.(e.target.value)}
      />
    );
  }

  if (field.type === 'dropdown' && field.options?.length) {
    return (
      <Select value={value || undefined} disabled={readOnly} onValueChange={(v) => onChange?.(v)}>
        <SelectTrigger className={`${common} h-full`}><SelectValue placeholder={field.placeholder ?? 'Select'} /></SelectTrigger>
        <SelectContent>
          {field.options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === 'yes_no') {
    return (
      <Select value={value || undefined} disabled={readOnly} onValueChange={(v) => onChange?.(v)}>
        <SelectTrigger className={`${common} h-full`}><SelectValue placeholder="Yes/No" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="Yes">Yes</SelectItem>
          <SelectItem value="No">No</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  const inputType = field.type === 'number' ? 'number'
    : field.type === 'date' || field.type === 'auto_date' ? 'date'
      : field.type === 'time' || field.type === 'auto_time' ? 'time'
        : field.type === 'datetime' ? 'datetime-local'
          : 'text';

  const autoReadOnly = readOnly || ['staff_identity', 'staff_id', 'auto_date', 'auto_time'].includes(field.type);

  return (
    <Input
      type={inputType}
      className={common}
      value={value}
      readOnly={autoReadOnly}
      placeholder={field.placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}

export function PdfFieldOverlay({
  pageWidth,
  pageHeight,
  fields,
  mode,
  values,
  selectedFieldId,
  onSelectField,
  onFieldChange,
  onFieldMove,
}: PdfFieldOverlayProps) {
  const interactive = mode === 'design' || mode === 'fill';
  const showHandles = mode === 'design';

  return (
    <div className="absolute inset-0 pointer-events-none">
      {fields.map((field) => {
        const rect = normalizedToPixels(
          { pageNumber: field.pageNumber, posX: field.posX, posY: field.posY, width: field.width, height: field.height },
          pageWidth,
          pageHeight,
        );
        const selected = selectedFieldId === field.id;
        const readOnly = mode === 'preview';

        return (
          <div
            key={field.id}
            className={`absolute pointer-events-auto ${showHandles ? 'cursor-move' : ''} ${selected ? 'ring-2 ring-primary z-20' : 'z-10'}`}
            style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectField?.(field.id);
            }}
            onPointerDown={(e) => {
              if (!showHandles || !onFieldMove) return;
              e.stopPropagation();
              const startX = e.clientX;
              const startY = e.clientY;
              const startPos = { posX: field.posX, posY: field.posY };

              const onMove = (ev: PointerEvent) => {
                const dx = (ev.clientX - startX) / pageWidth;
                const dy = (ev.clientY - startY) / pageHeight;
                onFieldMove(field.id, {
                  posX: Math.min(1 - field.width, Math.max(0, startPos.posX + dx)),
                  posY: Math.min(1 - field.height, Math.max(0, startPos.posY + dy)),
                });
              };
              const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
              };
              window.addEventListener('pointermove', onMove);
              window.addEventListener('pointerup', onUp);
            }}
          >
            <div className={`h-full w-full overflow-hidden ${interactive ? 'bg-white/75 backdrop-blur-[1px]' : 'bg-transparent'} ${mode === 'fill' ? 'hover:bg-white/85' : ''}`}>
              {interactive ? (
                <FieldInput
                  field={field}
                  value={values[field.fieldKey] ?? ''}
                  readOnly={readOnly}
                  onChange={(v) => onFieldChange?.(field.fieldKey, v)}
                />
              ) : (
                <div className="px-1 py-0.5 text-[11px] leading-tight whitespace-pre-wrap break-words">
                  {values[field.fieldKey] ?? ''}
                </div>
              )}
            </div>
            {showHandles && selected && (
              <span className="absolute -top-5 left-0 text-[10px] bg-primary text-primary-foreground px-1 rounded">
                {field.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
