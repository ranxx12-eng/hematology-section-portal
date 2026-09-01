'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PpmCalibrationDashboardStats } from '@/types/ppm-calibration';
import type { PpmCalibrationTab } from '@/types/ppm-calibration';

interface PpmCalibrationKpiCardsProps {
  stats: PpmCalibrationDashboardStats;
  onSelectTab: (tab: PpmCalibrationTab) => void;
}

const KPI_ITEMS: Array<{
  key: keyof PpmCalibrationDashboardStats;
  label: string;
  tab: PpmCalibrationTab;
  valueClassName?: string;
  borderClassName?: string;
}> = [
  { key: 'totalItems', label: 'Total Items', tab: 'overview' },
  { key: 'ppmDueSoon', label: 'PPM Due Soon', tab: 'due_soon', valueClassName: 'text-amber-600', borderClassName: 'hover:border-amber-500/40' },
  { key: 'ppmOverdue', label: 'PPM Overdue', tab: 'overdue', valueClassName: 'text-destructive', borderClassName: 'hover:border-destructive/40' },
  { key: 'calibrationDueSoon', label: 'Calibration Due Soon', tab: 'due_soon', valueClassName: 'text-amber-600', borderClassName: 'hover:border-amber-500/40' },
  { key: 'calibrationOverdue', label: 'Calibration Overdue', tab: 'overdue', valueClassName: 'text-destructive', borderClassName: 'hover:border-destructive/40' },
];

export function PpmCalibrationKpiCards({ stats, onSelectTab }: PpmCalibrationKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {KPI_ITEMS.map(({ key, label, tab, valueClassName, borderClassName }) => (
        <Card
          key={key}
          role="button"
          tabIndex={0}
          aria-label={`${label}: ${stats[key]}. Filter table.`}
          className={cn(
            'h-full cursor-pointer transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            borderClassName,
          )}
          onClick={() => onSelectTab(tab)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelectTab(tab);
            }
          }}
        >
          <CardContent className="flex h-full flex-col justify-center p-4">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className={cn('mt-1 text-2xl font-bold leading-none', valueClassName)}>{stats[key]}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
