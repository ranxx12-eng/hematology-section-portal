'use client';

import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';
import { DataTable } from '@/components/shared/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useEnvironmentalMonitoring } from '@/hooks/use-environmental-monitoring';
import { formatDateTime } from '@/lib/utils';

export default function EnvironmentalAuditTrailPage() {
  const locale = useLocale();
  const { auditEvents, loading, error } = useEnvironmentalMonitoring();
  const [eventFilter, setEventFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    if (eventFilter === 'all') return auditEvents;
    return auditEvents.filter((event) => event.eventType === eventFilter);
  }, [auditEvents, eventFilter]);

  const eventTypes = useMemo(
    () => Array.from(new Set(auditEvents.map((event) => event.eventType))).sort(),
    [auditEvents],
  );

  const columns: ColumnDef<(typeof auditEvents)[number]>[] = [
    { id: 'performedAt', header: 'When', cell: ({ row }) => formatDateTime(row.original.performedAt, locale) },
    { accessorKey: 'eventType', header: 'Event' },
    { accessorKey: 'recordType', header: 'Record Type' },
    { accessorKey: 'recordId', header: 'Record ID' },
    { accessorKey: 'performedByName', header: 'Performed By' },
    { accessorKey: 'performedByStaffId', header: 'Staff ID', cell: ({ row }) => row.original.performedByStaffId ?? '—' },
    { accessorKey: 'reason', header: 'Reason', cell: ({ row }) => row.original.reason ?? '—' },
  ];

  return (
    <PageContentSections
      pageKey="environmental_monitoring"
      fallbackTitle="Audit Trail"
      fallbackSubtitle="Append-only environmental monitoring audit history"
    >
      {loading && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
      {!loading && error && <p className="text-destructive">{error}</p>}
      {!loading && !error && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Audit Events</CardTitle>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Filter event type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                {eventTypes.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={filtered} searchKey="eventType" />
          </CardContent>
        </Card>
      )}
    </PageContentSections>
  );
}
