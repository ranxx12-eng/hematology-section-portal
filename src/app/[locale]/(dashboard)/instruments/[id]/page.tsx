'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Wrench, FlaskConical, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/components/providers/auth-provider';
import { statusBadgeVariant } from '@/lib/page-utils';
import { formatDate } from '@/lib/utils';
import { fetchInstrumentById } from '@/lib/clinical/instruments';
import { fetchMaintenanceRecords, resolveMaintenancePerformerIdentity } from '@/lib/clinical/maintenance-records';
import { fetchQCRecords } from '@/lib/clinical/qc-records';
import { StaffIdentity } from '@/components/shared/staff-identity';
import {
  INSTRUMENT_ITEM_TYPE_LABELS,
  formatMaintenanceFrequency,
} from '@/lib/ppm-calibration/constants';
import { canViewPpmCalibration } from '@/lib/ppm-calibration/permissions';
import type { Instrument, MaintenanceRecord, QCRecord } from '@/types';

export default function InstrumentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can } = useAuth();
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [qcRecords, setQcRecords] = useState<QCRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [instrumentResult, maintenanceResult, qcResult] = await Promise.all([
      fetchInstrumentById(id),
      fetchMaintenanceRecords(),
      fetchQCRecords(),
    ]);
    if (instrumentResult.error) {
      setError(instrumentResult.error);
      setInstrument(null);
    } else {
      setInstrument(instrumentResult.data);
    }
    setMaintenance(maintenanceResult.data.filter((m) => m.instrumentId === id));
    setQcRecords(qcResult.data.filter((q) => q.instrumentId === id));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const canViewPpm = canViewPpmCalibration(can);

  const accessDenied = !can('instruments.view');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !instrument) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild><Link href={`/${locale}/instruments`}><ArrowLeft className="h-4 w-4 me-2" />Back</Link></Button>
        <EmptyState title={tc('noData')} description={error ?? 'Instrument not found'} />
      </div>
    );
  }

  const maintColumns: ColumnDef<MaintenanceRecord>[] = [
    { accessorKey: 'maintenanceType', header: 'Type' },
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => formatDate(row.original.date, locale) },
    {
      accessorKey: 'performedBy',
      header: 'Performed By',
      cell: ({ row }) => {
        const identity = resolveMaintenancePerformerIdentity(row.original);
        return <StaffIdentity fullName={identity.fullName} staffId={identity.staffId} />;
      },
    },
    { accessorKey: 'result', header: 'Result', cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.result)}>{row.original.result}</Badge> },
    { accessorKey: 'shift', header: 'Shift' },
  ];

  const qcColumns: ColumnDef<QCRecord>[] = [
    { accessorKey: 'parameter', header: 'Parameter' },
    { accessorKey: 'level', header: 'Level' },
    { accessorKey: 'qcStatus', header: tc('status'), cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.qcStatus)}>{row.original.qcStatus}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" asChild>
          <Link href={`/${locale}/instruments`}><ArrowLeft className="h-4 w-4 me-2" />{tc('instruments')}</Link>
        </Button>
        {canViewPpm && (
          <Button variant="outline" asChild>
            <Link href={`/${locale}/ppm-calibration/${instrument.id}`}>PPM & Calibration History</Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="lg:w-96">
          <CardHeader>
            <CardTitle>{instrument.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {INSTRUMENT_ITEM_TYPE_LABELS[instrument.itemType ?? 'instrument']}
              {instrument.assetCode ? ` · ${instrument.assetCode}` : instrument.serialNumber ? ` · ${instrument.serialNumber}` : ''}
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Badge variant={statusBadgeVariant(instrument.status)}>{instrument.status.replace('_', ' ')}</Badge>
            {instrument.manufacturer && <p><span className="text-muted-foreground">Manufacturer:</span> {instrument.manufacturer}</p>}
            {instrument.model && <p><span className="text-muted-foreground">Model:</span> {instrument.model}</p>}
            {instrument.location && <p><span className="text-muted-foreground">Location:</span> {instrument.location}</p>}
            {instrument.section && <p><span className="text-muted-foreground">Section:</span> {instrument.section}</p>}
            {instrument.installationDate && <p><span className="text-muted-foreground">Installed:</span> {formatDate(instrument.installationDate, locale)}</p>}
            {instrument.ppmFrequency && <p><span className="text-muted-foreground">PPM Frequency:</span> {formatMaintenanceFrequency(instrument.ppmFrequency)}</p>}
            {instrument.calibrationFrequency && <p><span className="text-muted-foreground">Calibration Frequency:</span> {formatMaintenanceFrequency(instrument.calibrationFrequency)}</p>}
            {instrument.technicalSpecification && <p><span className="text-muted-foreground">Technical Specification:</span> {instrument.technicalSpecification}</p>}
            {instrument.lastMaintenance && <p><span className="text-muted-foreground">Last Maintenance:</span> {formatDate(instrument.lastMaintenance, locale)}</p>}
            {instrument.nextMaintenance && <p><span className="text-muted-foreground">Next Maintenance:</span> {formatDate(instrument.nextMaintenance, locale)}</p>}
            {instrument.serviceProvider && <p><span className="text-muted-foreground">Service:</span> {instrument.serviceProvider}</p>}
            {instrument.notes && <p><span className="text-muted-foreground">Notes:</span> {instrument.notes}</p>}
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
                <CardHeader><CardTitle>{INSTRUMENT_ITEM_TYPE_LABELS[instrument.itemType ?? 'instrument']} Information</CardTitle></CardHeader>
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
              {maintenance.length === 0 ? (
                <EmptyState title={tc('noData')} description="No maintenance records for this instrument." />
              ) : (
                <DataTable data={maintenance} columns={maintColumns} searchKey="maintenanceType" />
              )}
            </TabsContent>
            <TabsContent value="qc">
              {qcRecords.length === 0 ? (
                <EmptyState title={tc('noData')} description="No QC records for this instrument." />
              ) : (
                <DataTable data={qcRecords} columns={qcColumns} searchKey="parameter" />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
