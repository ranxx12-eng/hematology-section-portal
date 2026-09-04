'use client';

import { Input } from '@/components/ui/input';
import { StatusChip } from '@/components/ui/status-chip';
import type { QcLotVerificationParameter } from '@/types/qc-lot-verification';

export interface CbcParameterValues {
  manufacturerMean?: string;
  manufacturerSd?: string;
  establishedMean?: string;
  establishedSd?: string;
}

interface CbcParameterTableProps {
  parameters: QcLotVerificationParameter[];
  values: Record<string, CbcParameterValues>;
  editable: boolean;
  onChange: (parameterId: string, field: keyof CbcParameterValues, value: string) => void;
}

function resultVariant(result: string): 'success' | 'danger' | 'warning' | 'neutral' {
  switch (result) {
    case 'pass': return 'success';
    case 'fail': return 'danger';
    case 'manual_review': return 'warning';
    default: return 'neutral';
  }
}

export function CbcParameterTable({ parameters, values, editable, onChange }: CbcParameterTableProps) {
  return (
    <div className="rounded-2xl border overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/30">
            {['Parameter', 'Mfr Mean', 'Mfr SD', 'Mfr Lower', 'Mfr Upper', 'Est Mean', 'Est SD', 'Est Lower', 'Est Upper', 'Diff', 'SDI', 'Result'].map((h) => (
              <th key={h} className="p-2 text-left whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parameters.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="p-2 font-medium whitespace-nowrap">{p.parameterName}</td>
              <td className="p-2"><Input disabled={!editable} className="h-8 w-20" value={values[p.id]?.manufacturerMean ?? ''} onChange={(e) => onChange(p.id, 'manufacturerMean', e.target.value)} /></td>
              <td className="p-2"><Input disabled={!editable} className="h-8 w-20" value={values[p.id]?.manufacturerSd ?? ''} onChange={(e) => onChange(p.id, 'manufacturerSd', e.target.value)} /></td>
              <td className="p-2 text-muted-foreground">{p.manufacturerLower ?? '—'}</td>
              <td className="p-2 text-muted-foreground">{p.manufacturerUpper ?? '—'}</td>
              <td className="p-2"><Input disabled={!editable} className="h-8 w-20" value={values[p.id]?.establishedMean ?? ''} onChange={(e) => onChange(p.id, 'establishedMean', e.target.value)} /></td>
              <td className="p-2"><Input disabled={!editable} className="h-8 w-20" value={values[p.id]?.establishedSd ?? ''} onChange={(e) => onChange(p.id, 'establishedSd', e.target.value)} /></td>
              <td className="p-2 text-muted-foreground">{p.establishedLower ?? '—'}</td>
              <td className="p-2 text-muted-foreground">{p.establishedUpper ?? '—'}</td>
              <td className="p-2 text-muted-foreground">{p.difference ?? '—'}</td>
              <td className="p-2 text-muted-foreground">{p.sdi ?? '—'}</td>
              <td className="p-2"><StatusChip variant={resultVariant(p.result)} label={p.result.replace('_', ' ').toUpperCase()} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
