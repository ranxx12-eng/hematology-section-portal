'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, getDashboardStats } from '@/lib/mock/store';
import { downloadCSV } from '@/lib/utils';

const REPORTS = [
  { id: 'monthly-kpi', title: 'Monthly KPI Report', description: 'TAT, sample volume, and quality indicators' },
  { id: 'qc-summary', title: 'QC Summary Report', description: 'Quality control results and trends' },
  { id: 'maintenance-log', title: 'Maintenance Log', description: 'Equipment maintenance compliance' },
  { id: 'training-status', title: 'Training Status', description: 'Staff training completion rates' },
  { id: 'inventory-report', title: 'Inventory Report', description: 'Stock levels and expiry tracking' },
  { id: 'audit-summary', title: 'Audit Summary', description: 'System activity and changes' },
];

export default function ReportsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can } = useAuth();
  const db = useMemo(() => getMockDatabase(), []);
  const stats = useMemo(() => getDashboardStats(db), [db]);

  const accessDenied = !can('reports.view');


  useRouteReplace(accessDenied, `/${locale}/unauthorized`);


  if (accessDenied) return null;

  const exportCSV = (reportId: string) => {
    switch (reportId) {
      case 'monthly-kpi':
        downloadCSV('monthly-kpi.csv', ['Metric', 'Value'], [
          ['Total Samples', String(stats.totalSamples)],
          ['Routine Samples', String(stats.routineSamples)],
          ['STAT Samples', String(stats.statSamples)],
          ['Critical Values', String(stats.criticalValues)],
          ['Open Tasks', String(stats.openTasks)],
        ]);
        break;
      case 'qc-summary':
        downloadCSV('qc-summary.csv', ['Test', 'Result', 'Status'], db.qcRecords.slice(0, 20).map((r) => [r.test, String(r.result), r.status]));
        break;
      case 'maintenance-log':
        downloadCSV('maintenance-log.csv', ['Type', 'Date', 'Result'], db.maintenanceRecords.map((m) => [m.maintenanceType, m.date, m.result]));
        break;
      case 'training-status':
        downloadCSV('training-status.csv', ['Course', 'Category', 'Status'], db.trainingCourses.map((c) => [c.title, c.category, c.status]));
        break;
      case 'inventory-report':
        downloadCSV('inventory-report.csv', ['Item', 'Qty', 'Status'], db.inventoryItems.map((i) => [i.itemName, String(i.quantity), i.status]));
        break;
      case 'audit-summary':
        downloadCSV('audit-summary.csv', ['Action', 'Module', 'Date'], db.auditLogs.map((a) => [a.action, a.module, a.createdAt]));
        break;
    }
    toast.success('CSV exported');
  };

  const exportPDF = (title: string) => {
    const content = `Hematology Section Report\n${title}\nGenerated: ${new Date().toLocaleString()}\n\nThis is a demo PDF export.`;
    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('PDF exported (demo)');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tc('reports')}</h1>
        <p className="text-muted-foreground">Generate and export section reports</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{report.title}</CardTitle>
                  <CardDescription className="mt-1">{report.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => exportCSV(report.id)}>
                <Download className="h-4 w-4 me-1" />CSV
              </Button>
              <Button size="sm" onClick={() => exportPDF(report.title)}>
                <Download className="h-4 w-4 me-1" />PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
