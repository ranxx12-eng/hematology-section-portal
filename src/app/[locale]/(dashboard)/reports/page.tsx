'use client';

import { useState } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { FileText, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchReportExportData } from '@/lib/clinical/reports-data';
import { downloadCSV } from '@/lib/utils';

const REPORTS = [
  { id: 'monthly-kpi', title: 'Monthly KPI Report', description: 'Operational counts from live Supabase data', headers: ['Metric', 'Value'] as const },
  { id: 'qc-summary', title: 'QC Summary Report', description: 'Quality control results and trends', headers: ['Parameter', 'Level', 'QC Status'] as const },
  { id: 'maintenance-log', title: 'Maintenance Log', description: 'Equipment maintenance compliance', headers: ['Type', 'Date', 'Result'] as const },
  { id: 'training-status', title: 'Training Status', description: 'Staff training completion rates', headers: ['Course', 'Category', 'Status'] as const },
  { id: 'inventory-report', title: 'Inventory Report', description: 'Stock levels and expiry tracking', headers: ['Item', 'Qty', 'Status'] as const },
  { id: 'audit-summary', title: 'Audit Summary', description: 'System activity and changes', headers: ['Action', 'Module', 'Date'] as const },
];

export default function ReportsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can } = useAuth();
  const [exporting, setExporting] = useState<string | null>(null);

  const accessDenied = !can('reports.view');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  const exportCSV = async (reportId: string, headers: readonly string[]) => {
    setExporting(reportId);
    try {
      const rows = reportId === 'monthly-kpi'
        ? [['QC Records', 'See qc-summary'], ['Maintenance Records', 'See maintenance-log']]
        : await fetchReportExportData(reportId);
      downloadCSV(`${reportId}.csv`, [...headers], rows);
      toast.success('CSV exported');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tc('reports')}</h1>
        <p className="text-muted-foreground">Export operational reports from live Supabase data</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5 text-primary" />{report.title}</CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" disabled={exporting === report.id} onClick={() => exportCSV(report.id, report.headers)}>
                {exporting === report.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 me-2" />}
                Export CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
