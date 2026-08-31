'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import type { LiveMonthlyCellDetail } from '@/lib/environmental-monitoring/live-monthly-log';

interface LiveCellDetailSheetProps {
  cell: LiveMonthlyCellDetail | null;
  day?: number;
  locale: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LiveCellDetailSheet({ cell, day, locale, open, onOpenChange }: LiveCellDetailSheetProps) {
  if (!cell) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Day {day ?? '—'} · {cell.windowName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div><Badge variant="outline">{cell.status}</Badge></div>
          {cell.temperature && <p><span className="text-muted-foreground">Recorded Temperature:</span> {cell.temperature}°C</p>}
          {cell.humidity && <p><span className="text-muted-foreground">Recorded Humidity:</span> {cell.humidity}%</p>}
          {cell.acceptableTemperatureRange && <p><span className="text-muted-foreground">Acceptable Temperature:</span> {cell.acceptableTemperatureRange}</p>}
          {cell.acceptableHumidityRange && <p><span className="text-muted-foreground">Acceptable Humidity:</span> {cell.acceptableHumidityRange}</p>}
          {cell.recordedAt && <p><span className="text-muted-foreground">Recorded Time:</span> {formatDateTime(cell.recordedAt, locale)}</p>}
          {cell.performedByName && <p><span className="text-muted-foreground">Recorded By:</span> {cell.performedByName}{cell.initials ? ` (${cell.initials})` : ''}</p>}
          {cell.outOfRangeLabel && <p className="text-destructive font-medium">{cell.outOfRangeLabel}</p>}
          {cell.excursionStatus && <p><span className="text-muted-foreground">Excursion Status:</span> {cell.excursionStatus.replace(/_/g, ' ')}</p>}
          {cell.recheckTemperature != null && <p><span className="text-muted-foreground">Recheck Temperature:</span> {cell.recheckTemperature}°C</p>}
          {cell.recheckHumidity != null && <p><span className="text-muted-foreground">Recheck Humidity:</span> {cell.recheckHumidity}%</p>}
          {cell.recheckAt && <p><span className="text-muted-foreground">Recheck At:</span> {formatDateTime(cell.recheckAt, locale)}</p>}
          {cell.resolutionStatus && <p><span className="text-muted-foreground">Resolution:</span> {cell.resolutionStatus}</p>}
          {cell.immediateAction && <p><span className="text-muted-foreground">Immediate Action:</span> {cell.immediateAction}</p>}
          {cell.status === 'DUE' && <p className="text-amber-700">Reading is due for this shift.</p>}
          {cell.status === 'MISSING' && <p className="text-orange-800">No reading recorded for this shift.</p>}
          {cell.status === 'UPCOMING' && <p className="text-muted-foreground">This shift has not started yet.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
