'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Wrench, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/shared/data-table';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase } from '@/lib/mock/store';
import { statusBadgeVariant } from '@/lib/page-utils';
import { formatDate } from '@/lib/utils';
import type { MaintenanceRecord, QCRecord } from '@/types';

export default function InstrumentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can } = useAuth();
  const db = useMemo(() => getMockDatabase(), []);
  const instrument = db.instruments.find((i) => i.id === id);
  const maintenance = db.maintenanceRecords.filter((m) => m.instrumentId === id);
  const qcRecords = db.qcRecords.filter((q) => q.instrumentId === id);

  if (!can('instruments.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  if (!instrument) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild><Link href={`/${locale}/instruments`}><ArrowLeft className="h-4 w-4 me-2" />Back</Link></Button>
        <p className="text-muted-foreground">{tc('noData')}</p>
      </div>
    );
  }

  const maintColumns: ColumnDef<MaintenanceRecord>[] = [
    { accessorKey: 'maintenanceType', header: 'Type' },
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => formatDate(row.original.date, locale) },
    { accessorKey: 'result', header: 'Result', cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.result)}>{row.original.result}</Badge> },
    { accessorKey: 'shift', header: 'Shift' },
  ];

  const qcColumns: ColumnDef<QCRecord>[] = [
    { accessorKey: 'test', header: 'Test' },
    { accessorKey: 'controlLevel', header: 'Level' },
    { accessorKey: 'result', header: 'Result', cell: ({ row }) => row.original.result.toFixed(2) },
    { accessorKey: 'status', header: tc('status'), cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link href={`/${locale}/instruments`}><ArrowLeft className="h-4 w-4 me-2" />{tc('instruments')}</Link>
      </Button>

      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="lg:w-96">
          <CardHeader>
            <CardTitle>{instrument.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{instrument.serialNumber}</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Badge variant={statusBadgeVariant(instrument.status)}>{instrument.status.replace('_', ' ')}</Badge>
            <p><span className="text-muted-foreground">Manufacturer:</span> {instrument.manufacturer}</p>
            <p><span className="text-muted-foreground">Model:</span> {instrument.model}</p>
            <p><span className="text-muted-foreground">Location:</span> {instrument.location}</p>
            <p><span className="text-muted-foreground">Installed:</span> {formatDate(instrument.installationDate, locale)}</p>
            {instrument.lastMaintenance && <p><span className="text-muted-foreground">Last Maintenance:</span> {formatDate(instrument.lastMaintenance, locale)}</p>}
            {instrument.nextMaintenance && <p><span className="text-muted-foreground">Next Maintenance:</span> {formatDate(instrument.nextMaintenance, locale)}</p>}
            {instrument.serviceProvider && <p><span className="text-muted-foreground">Service:</span> {instrument.serviceProvider}</p>}
          </CardContent>
        </Card>

        <div className="flex-1">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="maintenance"><Wrench className="h-4 w-4 me-1" />Maintenance</TabsTrigger>
              <TabsTrigger value="qc"><FlaskConical className="h-4 w-4 me-1" />QC</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <Card>
                <CardHeader><CardTitle>Instrument Information</CardTitle></CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
                  {instrument.calibrationDueDate && <div><span className="text-muted-foreground">Calibration Due</span><p>{formatDate(instrument.calibrationDueDate, locale)}</p></div>}
                  {instrument.warrantyExpiry && <div><span className="text-muted-foreground">Warranty Expiry</span><p>{formatDate(instrument.warrantyExpiry, locale)}</p></div>}
                  {instrument.contactInfo && <div><span className="text-muted-foreground">Contact</span><p>{instrument.contactInfo}</p></div>}
                  <div><span className="text-muted-foreground">Maintenance Records</span><p>{maintenance.length}</p></div>
                  <div><span className="text-muted-foreground">QC Records</span><p>{qcRecords.length}</p></div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="maintenance">
              <DataTable data={maintenance} columns={maintColumns} searchKey="maintenanceType" />
            </TabsContent>
            <TabsContent value="qc">
              <DataTable data={qcRecords} columns={qcColumns} searchKey="test" />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
