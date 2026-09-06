'use client';

import { Fragment, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  cellStatusAriaLabel,
  cellStatusClass,
  cellStatusSymbol,
  daysInMonth,
  isCurrentCalendarDay,
  isValidCalendarDay,
} from '@/lib/stain-qc/calendar';
import { STAIN_QC_RESPONSIBILITY_LABELS } from '@/lib/stain-qc/constants';
import type {
  StainQcCellStatus,
  StainQcCorrectiveAction,
  StainQcCriterion,
  StainQcDailyResult,
  StainQcResponsibilityEntry,
  StainQcResponsibilityType,
} from '@/types/stain-qc';
import { StainQcDailyCell } from './stain-qc-daily-cell';

export interface MonthlyStainQcGridProps {
  criteria: StainQcCriterion[];
  month: number;
  year: number;
  dailyResults: StainQcDailyResult[];
  responsibilityEntries: StainQcResponsibilityEntry[];
  correctiveActions: StainQcCorrectiveAction[];
  readOnly?: boolean;
  canRecord?: boolean;
  onCellChange?: (input: {
    criterionKey: string;
    dayOfMonth: number;
    resultStatus: StainQcCellStatus | null;
    amendmentReason?: string;
  }) => Promise<void>;
  onCorrectiveSave?: (input: {
    dailyResultId: string;
    criterionKey: string;
    dayOfMonth: number;
    comment: string;
  }) => Promise<void>;
  onResponsibilityRecord?: (input: {
    responsibilityType: StainQcResponsibilityType;
    dayOfMonth: number;
  }) => Promise<void>;
}

const RESPONSIBILITY_TYPES: StainQcResponsibilityType[] = [
  'slide_prepared',
  'slide_checked',
  'qc_correction_change_stain',
];

export function MonthlyStainQcGrid({
  criteria,
  month,
  year,
  dailyResults,
  responsibilityEntries,
  correctiveActions,
  readOnly = false,
  canRecord = false,
  onCellChange,
  onCorrectiveSave,
  onResponsibilityRecord,
}: MonthlyStainQcGridProps) {
  const resultGrid = useMemo(() => {
    const grid: Record<string, Record<number, StainQcDailyResult>> = {};
    for (const result of dailyResults) {
      if (!grid[result.criterionKey]) grid[result.criterionKey] = {};
      grid[result.criterionKey]![result.dayOfMonth] = result;
    }
    return grid;
  }, [dailyResults]);

  const responsibilityGrid = useMemo(() => {
    const grid: Record<StainQcResponsibilityType, Record<number, StainQcResponsibilityEntry>> = {
      slide_prepared: {},
      slide_checked: {},
      qc_correction_change_stain: {},
    };
    for (const entry of responsibilityEntries) {
      grid[entry.responsibilityType][entry.dayOfMonth] = entry;
    }
    return grid;
  }, [responsibilityEntries]);

  const correctiveByResultId = useMemo(
    () => Object.fromEntries(correctiveActions.map((action) => [action.dailyResultId, action])),
    [correctiveActions],
  );

  const sections = useMemo(() => {
    const grouped = new Map<string, StainQcCriterion[]>();
    for (const criterion of criteria) {
      const list = grouped.get(criterion.sectionKey) ?? [];
      list.push(criterion);
      grouped.set(criterion.sectionKey, list);
    }
    return Array.from(grouped.entries()).map(([sectionKey, rows]) => ({
      sectionKey,
      sectionLabel: rows[0]?.sectionLabel ?? sectionKey,
      rows,
    }));
  }, [criteria]);

  const totalDays = daysInMonth(month, year);

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="min-w-[1200px] w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted/70">
            <th className="sticky left-0 z-20 bg-muted/70 border px-2 py-2 text-left min-w-[220px]">Criterion</th>
            <th className="sticky left-[220px] z-20 bg-muted/70 border px-2 py-2 text-left min-w-[120px]">Component</th>
            <th className="sticky left-[340px] z-20 bg-muted/70 border px-2 py-2 text-left min-w-[140px]">Ideal Color</th>
            {Array.from({ length: 31 }, (_, index) => {
              const day = index + 1;
              const disabled = !isValidCalendarDay(day, month, year);
              const current = isCurrentCalendarDay(day, month, year);
              return (
                <th
                  key={day}
                  className={cn(
                    'border px-1 py-2 text-center min-w-[44px]',
                    disabled && 'bg-muted/40 text-muted-foreground',
                    current && !disabled && 'bg-primary/10 font-semibold',
                  )}
                >
                  {day}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.sectionKey}>
              <tr key={`${section.sectionKey}-header`} className="bg-muted/30">
                <td colSpan={34} className="border px-2 py-1 font-semibold sticky left-0 z-10 bg-muted/30">
                  {section.sectionLabel}
                </td>
              </tr>
              {section.rows.map((criterion) => (
                <tr key={criterion.criterionKey}>
                  <td className="sticky left-0 z-10 bg-background border px-2 py-1 font-medium">{criterion.rowLabel}</td>
                  <td className="sticky left-[220px] z-10 bg-background border px-2 py-1 text-muted-foreground">{criterion.componentLabel ?? '—'}</td>
                  <td className="sticky left-[340px] z-10 bg-background border px-2 py-1 text-muted-foreground">{criterion.idealColor ?? '—'}</td>
                  {Array.from({ length: 31 }, (_, index) => {
                    const day = index + 1;
                    const disabled = day > totalDays;
                    const result = resultGrid[criterion.criterionKey]?.[day];
                    return (
                      <td key={`${criterion.criterionKey}-${day}`} className={cn('border p-0', disabled && 'bg-muted/30')}>
                        {!disabled && (
                          <StainQcDailyCell
                            status={result?.resultStatus ?? null}
                            readOnly={readOnly || !canRecord}
                            ariaLabel={`${criterion.rowLabel} day ${day}: ${cellStatusAriaLabel(result?.resultStatus ?? null)}`}
                            recordedByName={result?.recordedByName}
                            recordedByInitials={result?.recordedByInitials}
                            recordedAt={result?.recordedAt}
                            correctiveComment={result ? correctiveByResultId[result.id]?.comment : undefined}
                            onPrimaryClick={() => onCellChange?.({
                              criterionKey: criterion.criterionKey,
                              dayOfMonth: day,
                              resultStatus: 'acceptable',
                            })}
                            onSetStatus={(status, amendmentReason) => onCellChange?.({
                              criterionKey: criterion.criterionKey,
                              dayOfMonth: day,
                              resultStatus: status,
                              amendmentReason,
                            })}
                            onSaveCorrective={(comment) => {
                              if (!result?.id) return Promise.resolve();
                              return onCorrectiveSave?.({
                                dailyResultId: result.id,
                                criterionKey: criterion.criterionKey,
                                dayOfMonth: day,
                                comment,
                              }) ?? Promise.resolve();
                            }}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}

          {RESPONSIBILITY_TYPES.map((responsibilityType) => (
            <tr key={responsibilityType} className="bg-muted/10">
              <td colSpan={3} className="sticky left-0 z-10 bg-muted/10 border px-2 py-2 font-medium">
                {STAIN_QC_RESPONSIBILITY_LABELS[responsibilityType]}
              </td>
              {Array.from({ length: 31 }, (_, index) => {
                const day = index + 1;
                const disabled = day > totalDays;
                const entry = responsibilityGrid[responsibilityType][day];
                return (
                  <td key={`${responsibilityType}-${day}`} className={cn('border px-1 py-1 text-center', disabled && 'bg-muted/30')}>
                    {!disabled && (
                      <button
                        type="button"
                        className={cn(
                          'w-full min-h-10 rounded text-[11px]',
                          entry ? 'bg-background font-medium' : 'text-muted-foreground hover:bg-muted/40',
                          !readOnly && canRecord && 'cursor-pointer',
                          (readOnly || !canRecord) && 'cursor-default',
                        )}
                        disabled={readOnly || !canRecord}
                        aria-label={`${STAIN_QC_RESPONSIBILITY_LABELS[responsibilityType]} day ${day}`}
                        onClick={() => onResponsibilityRecord?.({ responsibilityType, dayOfMonth: day })}
                        title={entry ? `${entry.recordedByName} · ${new Date(entry.recordedAt).toLocaleString()}` : undefined}
                      >
                        {entry?.recordedByInitials ?? '—'}
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function stainQcCellDisplay(status: StainQcCellStatus | null): { symbol: string; className: string } {
  return {
    symbol: cellStatusSymbol(status),
    className: cellStatusClass(status),
  };
}
