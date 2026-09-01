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
  techName?: string;
  techStaffId?: string;
  counts: BodyFluidWorksheetFormData['counts'];
  derived: Pick<
    BodyFluidDerivedCounts,
    | 'tech1TotalWbc' | 'tech1AvgWbc' | 'tech1TotalRbc' | 'tech1AvgRbc'
    | 'tech2TotalWbc' | 'tech2AvgWbc' | 'tech2TotalRbc' | 'tech2AvgRbc'
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
  techName,
  techStaffId,
  counts,
  derived,
  editable,
  onChange,
}: BodyFluidCountGridProps) {
  const prefix = techNumber === 1 ? 'tech1' : 'tech2';
  const totalWbc = derived[`${prefix}TotalWbc` as keyof typeof derived] as number | undefined;
  const avgWbc = derived[`${prefix}AvgWbc` as keyof typeof derived] as number | undefined;
  const totalRbc = derived[`${prefix}TotalRbc` as keyof typeof derived] as number | undefined;
  const avgRbc = derived[`${prefix}AvgRbc` as keyof typeof derived] as number | undefined;

  const updateCount = (cellType: 'wbc' | 'rbc', squareNumber: number, raw: string) => {
    const countValue = raw === '' ? undefined : Number(raw);
    onChange(
      counts.map((entry) => (
        entry.techNumber === techNumber
          && entry.cellType === cellType
          && entry.squareNumber === squareNumber
          ? { ...entry, countValue: Number.isNaN(countValue) ? undefined : countValue }
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
        <p className="font-semibold">Tech #{techNumber} Cell Count</p>
        {techName && (
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
            <th className="p-2 text-center">Total</th>
            <th className="p-2 text-center">Average</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t">
            <td className="p-2 font-medium">WBC</td>
            {Array.from({ length: RBC_SQUARE_COUNT }, (_, index) => renderSquareCell('wbc', index + 1))}
            <td className="p-2 text-center font-medium">{formatNumber(totalWbc)}</td>
            <td className="p-2 text-center font-medium">{formatNumber(avgWbc)}</td>
          </tr>
          <tr className="border-t">
            <td className="p-2 font-medium">RBC</td>
            {Array.from({ length: RBC_SQUARE_COUNT }, (_, index) => renderSquareCell('rbc', index + 1))}
            <td className="p-2 text-center font-medium">{formatNumber(totalRbc)}</td>
            <td className="p-2 text-center font-medium">{formatNumber(avgRbc)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
