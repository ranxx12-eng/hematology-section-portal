'use client';

import { Label } from '@/components/ui/label';
import { QC_DECISIONS, QC_DECISION_LABELS, type QCDecision } from '@/lib/qc-records/constants';
import { cn } from '@/lib/utils';

interface QCDecisionFieldProps {
  idPrefix: string;
  label: string;
  value: QCDecision;
  onChange: (value: QCDecision) => void;
  required?: boolean;
}

export function QCDecisionField({
  idPrefix,
  label,
  value,
  onChange,
  required = true,
}: QCDecisionFieldProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium leading-none">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </legend>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {QC_DECISIONS.map((decision) => {
          const inputId = `${idPrefix}-${decision}`;
          const selected = value === decision;

          return (
            <Label
              key={decision}
              htmlFor={inputId}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-normal transition-colors',
                selected ? 'border-primary bg-primary/5' : 'border-input hover:bg-muted/50',
              )}
            >
              <input
                id={inputId}
                type="radio"
                name={idPrefix}
                value={decision}
                checked={selected}
                onChange={() => onChange(decision)}
                className="h-4 w-4 accent-primary"
              />
              {QC_DECISION_LABELS[decision]}
            </Label>
          );
        })}
      </div>
    </fieldset>
  );
}
