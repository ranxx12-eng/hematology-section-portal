'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { QC_IN_OUT_STATUSES } from '@/lib/qc-records/constants';
import type { QCLiveFetchFilters } from '@/lib/qc-records/live-view';
import { cn } from '@/lib/utils';

type PeriodPreset = 'today' | '7days' | '30days' | 'custom';

interface QCLiveFiltersProps {
  period: PeriodPreset;
  onPeriodChange: (period: PeriodPreset) => void;
  filters: QCLiveFetchFilters;
  onFiltersChange: (filters: QCLiveFetchFilters) => void;
  parameterOptions: string[];
  levelOptions: string[];
}

const PERIOD_BUTTONS: { key: PeriodPreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7days', label: 'Last 7 Days' },
  { key: '30days', label: 'Last 30 Days' },
  { key: 'custom', label: 'Custom Range' },
];

export function QCLiveFilters({
  period,
  onPeriodChange,
  filters,
  onFiltersChange,
  parameterOptions,
  levelOptions,
}: QCLiveFiltersProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PERIOD_BUTTONS.map(({ key, label }) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={period === key ? 'default' : 'outline'}
              onClick={() => onPeriodChange(key)}
              className={cn(period === key && 'pointer-events-none')}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {period === 'custom' && (
            <>
              <div>
                <Label htmlFor="date-from">Date From</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={filters.dateFrom ?? ''}
                  onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="date-to">Date To</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={filters.dateTo ?? ''}
                  onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
                />
              </div>
            </>
          )}

          <div>
            <Label>Parameter</Label>
            <Select
              value={filters.parameter ?? 'all'}
              onValueChange={(v) => onFiltersChange({ ...filters, parameter: v, level: 'all' })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {parameterOptions.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Level</Label>
            <Select
              value={filters.level ?? 'all'}
              onValueChange={(v) => onFiltersChange({ ...filters, level: v })}
              disabled={levelOptions.length === 0}
            >
              <SelectTrigger><SelectValue placeholder={levelOptions.length ? 'All' : 'Select parameter'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {levelOptions.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>QC Status</Label>
            <Select
              value={filters.qcStatus ?? 'all'}
              onValueChange={(v) => onFiltersChange({ ...filters, qcStatus: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {QC_IN_OUT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Resolution Status</Label>
            <Select
              value={filters.resolution ?? 'all'}
              onValueChange={(v) => onFiltersChange({ ...filters, resolution: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="unresolved">Unresolved</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Still OUT">Still OUT</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
