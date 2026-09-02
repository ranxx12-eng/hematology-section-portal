'use client';

import { Input } from '@/components/ui/input';
import {
  RBC_SQUARE_COUNT,
  WBC_SQUARE_COUNT,
  type BodyFluidDerivedCounts,
} from '@/lib/medical-reports/body-fluid-logic';
import type { BodyFluidWorksheetFormData } from '@/lib/medical-reports/body-fluid-schema';

interface BodyFluidCountGridProps {
  techNumber: 1 | 2;
  sideNumber: 1 | 2;
  sideLabel?: string;
  techName?: string;
  techStaffId?: string;
  counts: BodyFluidWorksheetFormData['counts'];
  derived: Pick<
    BodyFluidDerivedCounts,
    | 'tech1TotalWbc' | 'tech1AvgWbc' | 'tech1TotalRbc' | 'tech1AvgRbc'
    | 'tech2TotalWbc' | 'tech2AvgWbc' | 'tech2TotalRbc' | 'tech2AvgRbc'
    | 'tech1Side1Wbc' | 'tech1Side2Wbc' | 'tech1Side1Rbc' | 'tech1Side2Rbc'
    | 'tech2Side1Wbc' | 'tech2Side2Wbc' | 'tech2Side1Rbc' | 'tech2Side2Rbc'
    | 'tech1FinalWbc' | 'tech1FinalRbc' | 'tech2FinalWbc' | 'tech2FinalRbc'
  >;
  editable: boolean;
  onChange: (counts: BodyFluidWorksheetFormData['counts']) => void;
}

function formatNumber(value?: number): string {
  if (value == null) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function BodyFluidCountGrid({
  techNumber,
  sideNumber,
  sideLabel,
  techName,
  techStaffId,
  counts,
  derived,
  editable,
  onChange,
}: BodyFluidCountGridProps) {
  const sideTotals = sideNumber === 1
    ? {
      wbc: techNumber === 1 ? derived.tech1Side1Wbc : derived.tech2Side1Wbc,
      rbc: techNumber === 1 ? derived.tech1Side1Rbc : derived.tech2Side1Rbc,
    }
    : {
      wbc: techNumber === 1 ? derived.tech1Side2Wbc : derived.tech2Side2Wbc,
      rbc: techNumber === 1 ? derived.tech1Side2Rbc : derived.tech2Side2Rbc,
    };

  const updateCount = (cellType: 'wbc' | 'rbc', squareNumber: number, raw: string) => {
    const countValue = raw === '' ? undefined : Number(raw);
    onChange(
      counts.map((entry) => (
        entry.techNumber === techNumber
          && (entry.sideNumber ?? 1) === sideNumber
          && entry.cellType === cellType
          && entry.squareNumber === squareNumber
          ? { ...entry, sideNumber, countValue: Number.isNaN(countValue) ? undefined : countValue }
          : entry
      )),
    );
  };

  const renderSquareCell = (cellType: 'wbc' | 'rbc', squareNumber: number) => {
    const maxSquares = cellType === 'wbc' ? WBC_SQUARE_COUNT : RBC_SQUARE_COUNT;
    if (squareNumber > maxSquares) {
      return <td key={`${cellType}-${squareNumber}`} className="p-1 bg-muted/20" />;
    }

    const value = counts.find(
      (entry) => entry.techNumber === techNumber
        && (entry.sideNumber ?? 1) === sideNumber
        && entry.cellType === cellType
        && entry.squareNumber === squareNumber,
    )?.countValue;

    return (
      <td key={`${cellType}-${squareNumber}`} className="p-1">
        {editable ? (
          <Input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            className="h-8 min-w-[4rem] text-center"
            value={value ?? ''}
            onChange={(event) => updateCount(cellType, squareNumber, event.target.value)}
          />
        ) : (
          <span className="block text-center">{value ?? '—'}</span>
        )}
      </td>
    );
  };

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div className="border-b bg-muted/40 px-3 py-2">
        <p className="font-semibold">
          Tech #{techNumber}
          {sideLabel ? ` — ${sideLabel}` : ''}
        </p>
        {techName && sideNumber === 1 && (
          <p className="text-sm text-muted-foreground">
            {techName}
            {techStaffId ? ` — Staff ID: ${techStaffId}` : ''}
          </p>
        )}
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-2 text-left" />
            {Array.from({ length: RBC_SQUARE_COUNT }, (_, index) => (
              <th key={`head-${index}`} className="p-2 text-center">Square {index + 1}</th>
            ))}
            <th className="p-2 text-center">Side Result</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t">
            <td className="p-2 font-medium">WBC</td>
            {Array.from({ length: RBC_SQUARE_COUNT }, (_, index) => renderSquareCell('wbc', index + 1))}
            <td className="p-2 text-center font-medium">{formatNumber(sideTotals.wbc)}</td>
          </tr>
          <tr className="border-t">
            <td className="p-2 font-medium">RBC</td>
            {Array.from({ length: RBC_SQUARE_COUNT }, (_, index) => renderSquareCell('rbc', index + 1))}
            <td className="p-2 text-center font-medium">{formatNumber(sideTotals.rbc)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function BodyFluidTechFinalSummary({
  techNumber,
  derived,
}: {
  techNumber: 1 | 2;
  derived: Pick<BodyFluidDerivedCounts, 'tech1FinalWbc' | 'tech1FinalRbc' | 'tech2FinalWbc' | 'tech2FinalRbc'>;
}) {
  const finalWbc = techNumber === 1 ? derived.tech1FinalWbc : derived.tech2FinalWbc;
  const finalRbc = techNumber === 1 ? derived.tech1FinalRbc : derived.tech2FinalRbc;
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
      <p className="font-medium">Tech #{techNumber} Final</p>
      <p>WBC: {formatNumber(finalWbc)} Cells/mm³</p>
      <p>RBC: {formatNumber(finalRbc)} Cells/mm³</p>
    </div>
  );
}
