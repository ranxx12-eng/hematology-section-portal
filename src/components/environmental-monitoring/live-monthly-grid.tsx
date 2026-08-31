'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { OFFICIAL_SHIFT_LABELS } from '@/lib/print/environmental-print-templates';
import type { LiveMonthlyCellDetail } from '@/lib/environmental-monitoring/live-monthly-log';

const SHIFT_ORDER = ['AM Shift', 'PM Shift', 'Night Shift'] as const;

function cellStatusClass(status: LiveMonthlyCellDetail['status']): string {
  switch (status) {
    case 'OUT OF RANGE':
      return 'bg-red-100 text-red-900 border-red-300 font-semibold';
    case 'DUE':
      return 'bg-amber-100 text-amber-900 border-amber-300';
    case 'MISSING':
      return 'bg-orange-100 text-orange-950 border-orange-300 font-semibold';
    case 'IN RANGE':
      return 'bg-emerald-50 text-emerald-900 border-emerald-200';
    default:
      return 'bg-muted/40 text-muted-foreground border-border';
  }
}

interface LiveMonthlyGridProps {
  grid: Record<number, Record<string, LiveMonthlyCellDetail>>;
  month: number;
  year: number;
  showHumidity: boolean;
  onCellClick?: (cell: LiveMonthlyCellDetail, day: number) => void;
}

export function LiveMonthlyGrid({ grid, month, year, showHumidity, onCellClick }: LiveMonthlyGridProps) {
  const totalDays = new Date(year, month, 0).getDate();

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full min-w-[960px] border-collapse text-xs">
        <thead>
          <tr className="bg-muted/60">
            <th rowSpan={2} className="border px-2 py-2 text-left sticky left-0 bg-muted/60 z-10">DAY</th>
            {SHIFT_ORDER.map((shift) => (
              <th key={shift} colSpan={showHumidity ? 4 : 3} className="border px-2 py-2 text-center">
                <div className="font-semibold">{OFFICIAL_SHIFT_LABELS[shift].label}</div>
                <div className="text-[10px] font-normal text-muted-foreground">{OFFICIAL_SHIFT_LABELS[shift].time}</div>
              </th>
            ))}
          </tr>
          <tr className="bg-muted/40">
            {SHIFT_ORDER.flatMap((shift) => (
              showHumidity
                ? [
                    <th key={`${shift}-temp`} className="border px-1 py-1">Temp</th>,
                    <th key={`${shift}-hum`} className="border px-1 py-1">Hum</th>,
                    <th key={`${shift}-init`} className="border px-1 py-1">Initials</th>,
                    <th key={`${shift}-status`} className="border px-1 py-1">Status</th>,
                  ]
                : [
                    <th key={`${shift}-temp`} className="border px-1 py-1">Temp</th>,
                    <th key={`${shift}-init`} className="border px-1 py-1">Initials</th>,
                    <th key={`${shift}-status`} className="border px-1 py-1">Status</th>,
                  ]
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 31 }, (_, index) => {
            const day = index + 1;
            const disabled = day > totalDays;
            const dayData = disabled ? {} : (grid[day] ?? {});

            return (
              <tr key={day} className={disabled ? 'opacity-40' : undefined}>
                <td className="border px-2 py-1 font-medium sticky left-0 bg-background z-10">{day}</td>
                {SHIFT_ORDER.flatMap((shift) => {
                  const cell = dayData[shift];
                  if (disabled || !cell) {
                    return showHumidity
                      ? [
                          <td key={`${day}-${shift}-temp`} className="border px-1 py-1 text-center">—</td>,
                          <td key={`${day}-${shift}-hum`} className="border px-1 py-1 text-center">—</td>,
                          <td key={`${day}-${shift}-init`} className="border px-1 py-1 text-center">—</td>,
                          <td key={`${day}-${shift}-status`} className="border px-1 py-1 text-center">—</td>,
                        ]
                      : [
                          <td key={`${day}-${shift}-temp`} className="border px-1 py-1 text-center">—</td>,
                          <td key={`${day}-${shift}-init`} className="border px-1 py-1 text-center">—</td>,
                          <td key={`${day}-${shift}-status`} className="border px-1 py-1 text-center">—</td>,
                        ];
                  }

                  const clickable = Boolean(onCellClick && (cell.temperature || cell.status !== 'UPCOMING'));
                  const statusBadge = (
                    <Badge variant="outline" className={cn('text-[10px] px-1 py-0 h-auto whitespace-normal', cellStatusClass(cell.status))}>
                      {cell.status}
                    </Badge>
                  );

                  const cells = [
                    <td key={`${day}-${shift}-temp`} className="border px-1 py-1 text-center">{cell.temperature ? `${cell.temperature}°C` : '—'}</td>,
                    ...(showHumidity ? [<td key={`${day}-${shift}-hum`} className="border px-1 py-1 text-center">{cell.humidity ? `${cell.humidity}%` : '—'}</td>] : []),
                    <td key={`${day}-${shift}-init`} className="border px-1 py-1 text-center">{cell.initials ?? '—'}</td>,
                    <td
                      key={`${day}-${shift}-status`}
                      className={cn('border px-1 py-1 text-center', clickable && 'cursor-pointer hover:bg-muted/30')}
                      onClick={clickable ? () => onCellClick?.(cell, day) : undefined}
                      onKeyDown={clickable ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') onCellClick?.(cell, day);
                      } : undefined}
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                    >
                      {statusBadge}
                    </td>,
                  ];
                  return cells;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
