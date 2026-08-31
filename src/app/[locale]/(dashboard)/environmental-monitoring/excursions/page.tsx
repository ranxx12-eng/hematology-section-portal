'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { ExcursionWorkflowPanel } from '@/components/environmental-monitoring/excursion-workflow-panel';
import { useEnvironmentalMonitoring } from '@/hooks/use-environmental-monitoring';
import { ENVIRONMENTAL_EXCURSION_STATUS_LABELS } from '@/lib/environmental-monitoring/constants';
import { formatEnvironmentalRange } from '@/lib/environmental-monitoring/permissions';
import { formatDateTime } from '@/lib/utils';
import type { EnvironmentalAsset, EnvironmentalExcursion } from '@/types/environmental-monitoring';

function ExcursionsContent() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get('status');
  const { assets, excursions, loading, error, reload } = useEnvironmentalMonitoring();
  const [selected, setSelected] = useState<EnvironmentalExcursion | null>(null);

  const assetMap = useMemo(() => Object.fromEntries(assets.map((asset) => [asset.id, asset])), [assets]);

  const filtered = useMemo(() => {
    if (statusFilter === 'open') {
      return excursions.filter((item) => !item.voidedAt && ['open', 'under_action', 'awaiting_recheck'].includes(item.status));
    }
    return excursions.filter((item) => !item.voidedAt);
  }, [excursions, statusFilter]);

  const columns: ColumnDef<EnvironmentalExcursion>[] = [
    {
      id: 'asset',
      header: 'Asset',
      cell: ({ row }) => assetMap[row.original.assetId]?.assetName ?? '—',
    },
    {
      id: 'detectedAt',
      header: 'Detected At',
      cell: ({ row }) => formatDateTime(row.original.detectedAt, locale),
    },
    {
      id: 'temperature',
      header: 'Temperature',
      cell: ({ row }) => `${row.original.detectedTemperature}°C`,
    },
    {
      id: 'range',
      header: 'Acceptable Range',
      cell: ({ row }) => formatEnvironmentalRange(row.original.rangeMinAtDetection, row.original.rangeMaxAtDetection),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant={row.original.status === 'resolved' ? 'success' : 'destructive'}>{ENVIRONMENTAL_EXCURSION_STATUS_LABELS[row.original.status]}</Badge>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={() => setSelected(row.original)}>Manage</Button>
      ),
    },
  ];

  return (
    <PageContentSections
      pageKey="environmental_monitoring"
      fallbackTitle="Environmental Excursions"
      fallbackSubtitle="Out-of-range events and corrective action workflow"
    >
      {loading && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
      {!loading && error && <p className="text-destructive">{error}</p>}
      {!loading && !error && (
        <Card>
          <CardHeader><CardTitle>Excursions</CardTitle></CardHeader>
          <CardContent>
            <DataTable columns={columns} data={filtered} searchKey="status" />
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Excursion Workflow</DialogTitle></DialogHeader>
          {selected && assetMap[selected.assetId] && (
            <ExcursionWorkflowPanel
              excursion={selected}
              asset={assetMap[selected.assetId] as EnvironmentalAsset}
              onUpdated={async () => { await reload(); setSelected(null); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageContentSections>
  );
}

export default function EnvironmentalExcursionsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <ExcursionsContent />
    </Suspense>
  );
}
