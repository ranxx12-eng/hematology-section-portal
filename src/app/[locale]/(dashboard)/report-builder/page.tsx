'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Download, BarChart3, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog } from '@/lib/page-utils';
import { downloadCSV, generateId } from '@/lib/utils';
import { BRAND_COLORS } from '@/lib/brand/colors';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { ReportTemplate } from '@/types/modules';

const TABLES: Record<string, { label: string; columns: string[]; getData: (db: ReturnType<typeof getMockDatabase>) => Record<string, unknown>[] }> = {
  criticalValues: { label: 'Critical Values', columns: ['date', 'patientName', 'test', 'criticalValue', 'department'], getData: (db) => db.criticalValues as unknown as Record<string, unknown>[] },
  sampleRejections: { label: 'Sample Rejections', columns: ['patientName', 'department', 'rejectionDate', 'rejectedTests'], getData: (db) => db.sampleRejections.map((r) => ({ ...r, rejectedTests: r.rejectedTests.join(', ') })) as unknown as Record<string, unknown>[] },
  tasks: { label: 'Tasks', columns: ['title', 'priority', 'status', 'dueDate'], getData: (db) => db.tasks as unknown as Record<string, unknown>[] },
  tatRecords: { label: 'TAT Records', columns: ['testType', 'priority', 'calculatedTat', 'status'], getData: (db) => db.tatRecords as unknown as Record<string, unknown>[] },
};

export default function ReportBuilderPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('report_builder.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [selectedId, setSelectedId] = useState<string | null>(db.reportTemplates[0]?.id ?? null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', table: 'criticalValues', chartType: 'bar' as ReportTemplate['chartType'], chartColumn: '' });
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  if (!can('report_builder.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const template = db.reportTemplates.find((t) => t.id === selectedId);

  const reportData = useMemo(() => {
    if (!template) return [];
    const tableDef = TABLES[template.table];
    if (!tableDef) return [];
    return tableDef.getData(db).map((row) => {
      const filtered: Record<string, unknown> = {};
      template.columns.forEach((col) => { filtered[col] = row[col as keyof typeof row]; });
      return filtered;
    });
  }, [template, db]);

  const chartData = useMemo(() => {
    if (!template?.chartColumn || template.chartType === 'none') return [];
    const counts: Record<string, number> = {};
    reportData.forEach((row) => {
      const key = String(row[template.chartColumn!] ?? 'Unknown');
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [reportData, template]);

  const createTemplate = () => {
    if (!canManage || !user || !form.name) return;
    const tableDef = TABLES[form.table];
    const tpl: ReportTemplate = {
      id: generateId(),
      name: form.name,
      table: form.table,
      columns: tableDef.columns,
      filters: [],
      chartType: form.chartType,
      chartColumn: form.chartColumn || tableDef.columns[0],
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.reportTemplates.push(tpl);
    appendAuditLog(db, user.id, 'create', 'report_builder', tpl.id);
    saveMockDatabase(db);
    setSelectedId(tpl.id);
    refresh();
    setDialogOpen(false);
    toast.success('Report template saved');
  };

  const exportExcel = () => {
    if (!template) return;
    downloadCSV(`${template.name.replace(/\s+/g, '-').toLowerCase()}.csv`, template.columns, reportData.map((r) => template.columns.map((c) => String(r[c] ?? ''))));
    if (user) { appendAuditLog(db, user.id, 'export', 'report_builder', template.id); saveMockDatabase(db); }
    toast.success('Exported to Excel (CSV)');
  };

  const exportPDF = () => {
    if (!template) return;
    const content = `Report: ${template.name}\nGenerated: ${new Date().toLocaleString()}\n\n${JSON.stringify(reportData.slice(0, 20), null, 2)}`;
    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${template.name.replace(/\s+/g, '-').toLowerCase()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('PDF exported (demo)');
  };

  const deleteTemplate = (id: string) => {
    if (!canManage || !user || !confirm(tc('confirmDelete'))) return;
    db.reportTemplates = db.reportTemplates.filter((t) => t.id !== id);
    appendAuditLog(db, user.id, 'delete', 'report_builder', id);
    saveMockDatabase(db);
    setSelectedId(db.reportTemplates[0]?.id ?? null);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Report Builder</h1>
          <p className="text-muted-foreground">Create custom reports with filters, charts, and exports</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />New Template</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Save Report Template</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Data Table</Label>
                  <Select value={form.table} onValueChange={(v) => setForm({ ...form, table: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TABLES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Chart Type</Label>
                  <Select value={form.chartType ?? 'bar'} onValueChange={(v) => setForm({ ...form, chartType: v as ReportTemplate['chartType'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bar">Bar Chart</SelectItem>
                      <SelectItem value="pie">Pie Chart</SelectItem>
                      <SelectItem value="none">No Chart</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={createTemplate}>{tc('save')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Templates</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {db.reportTemplates.map((t) => (
              <button key={t.id} onClick={() => setSelectedId(t.id)} className={`w-full text-start rounded-lg px-3 py-2 text-sm flex items-center justify-between ${selectedId === t.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}>
                {t.name}
                {canManage && <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>}
              </button>
            ))}
          </CardContent>
        </Card>

        {template && (
          <div className="lg:col-span-3 space-y-4">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={exportExcel}><Download className="h-4 w-4 me-1" />Export Excel</Button>
              <Button size="sm" onClick={exportPDF}><Download className="h-4 w-4 me-1" />Export PDF</Button>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />{template.name}</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {template.columns.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}
                </div>
                <p className="text-sm text-muted-foreground mb-4">{reportData.length} records from {TABLES[template.table]?.label}</p>

                {chartData.length > 0 && template.chartType === 'bar' && (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData}>
                      <XAxis dataKey="name" /><YAxis /><Tooltip />
                      <Bar dataKey="value" fill={BRAND_COLORS.primary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {chartData.length > 0 && template.chartType === 'pie' && (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                        {chartData.map((_, i) => <Cell key={i} fill={BRAND_COLORS.chart[i % BRAND_COLORS.chart.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
