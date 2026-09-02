'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CONTROLLED_FORM_EXPORT_PDF_LABEL,
  CONTROLLED_FORM_PRINT_LABEL,
} from '@/lib/print/controlled-form';
import {
  filterRecordsByDateRange,
  REPORT_DATE_RANGE_PRESET_LABELS,
  REPORT_DATE_RANGE_PRESETS,
  toLocalDateString,
  type ReportDateRange,
  type ReportDateRangePreset,
} from '@/lib/print/report-date-range';

export type ReportExportAction = 'print' | 'pdf';

interface ReportDateRangeDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleName: string;
  records: T[];
  getRecordDate: (record: T) => string | Date | null | undefined;
  action: ReportExportAction;
  onConfirm: (range: ReportDateRange, filteredRecords: T[]) => void;
}

export function ReportDateRangeDialog<T>({
  open,
  onOpenChange,
  moduleName,
  records,
  getRecordDate,
  action,
  onConfirm,
}: ReportDateRangeDialogProps<T>) {
  const [preset, setPreset] = useState<ReportDateRangePreset>('this_month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [emptyAttempt, setEmptyAttempt] = useState(false);

  useEffect(() => {
    if (!open) return;
    const today = toLocalDateString(new Date());
    setPreset('this_month');
    setFromDate(today);
    setToDate(today);
    setEmptyAttempt(false);
  }, [open]);

  const range = useMemo<ReportDateRange>(() => ({
    preset,
    from: preset === 'custom' ? fromDate : undefined,
    to: preset === 'custom' ? toDate : undefined,
  }), [preset, fromDate, toDate]);

  const filteredRecords = useMemo(
    () => filterRecordsByDateRange(records, getRecordDate, range),
    [records, getRecordDate, range],
  );

  const confirmLabel = action === 'print' ? CONTROLLED_FORM_PRINT_LABEL : CONTROLLED_FORM_EXPORT_PDF_LABEL;

  const handleConfirm = () => {
    if (filteredRecords.length === 0) {
      setEmptyAttempt(true);
      return;
    }
    onConfirm(range, filteredRecords);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Print Date Range</DialogTitle>
          <p className="text-sm text-muted-foreground">{moduleName}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="report-date-preset">Period</Label>
            <Select value={preset} onValueChange={(v) => {
              setPreset(v as ReportDateRangePreset);
              setEmptyAttempt(false);
            }}>
              <SelectTrigger id="report-date-preset"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_DATE_RANGE_PRESETS.map((p) => (
                  <SelectItem key={p} value={p}>{REPORT_DATE_RANGE_PRESET_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {preset === 'custom' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="report-from-date">From Date</Label>
                <Input
                  id="report-from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => { setFromDate(e.target.value); setEmptyAttempt(false); }}
                />
              </div>
              <div>
                <Label htmlFor="report-to-date">To Date</Label>
                <Input
                  id="report-to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => { setToDate(e.target.value); setEmptyAttempt(false); }}
                />
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            {filteredRecords.length} record{filteredRecords.length === 1 ? '' : 's'} match this period.
          </p>

          {emptyAttempt && filteredRecords.length === 0 && (
            <p className="text-sm text-destructive" role="alert">
              No records found for the selected date range.
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm}>{confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
