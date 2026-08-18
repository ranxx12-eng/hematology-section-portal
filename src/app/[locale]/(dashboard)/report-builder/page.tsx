'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Download, BarChart3, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/components/providers/auth-provider';
import {
  createReportTemplate,
  fetchReportModuleData,
  fetchReportTemplates,
  softDeleteReportTemplate,
} from '@/lib/clinical/report-templates';
import { REPORT_MODULES, reportTemplateFormSchema, type ReportTemplateFormData } from '@/lib/report-builder/schema';
import { downloadCSV } from '@/lib/utils';
import { BRAND_COLORS } from '@/lib/brand/colors';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { ReportTemplate } from '@/types/modules';

export default function ReportBuilderPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('report_builder.manage');
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [moduleData, setModuleData] = useState<Record<string, unknown>[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ReportTemplateFormData>({
    name: '',
    table: 'criticalValues',
    chartType: 'bar',
    chartColumn: '',
  });

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchReportTemplates();
    setTemplates(result.data);
    setError(result.error);
    if (!selectedId && result.data[0]) setSelectedId(result.data[0].id);
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const template = templates.find((t) => t.id === selectedId) ?? null;

  useEffect(() => {
    if (!template) {
      setModuleData([]);
      return;
    }
    setDataLoading(true);
    void fetchReportModuleData(template.table).then((result) => {
      setModuleData(result.data);
      if (result.error) toast.error(result.error);
      setDataLoading(false);
    });
  }, [template?.id, template?.table]);

  const accessDenied = !can('report_builder.view');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  const reportData = useMemo(() => {
    if (!template) return [];
    return moduleData.map((row) => {
      const filtered: Record<string, unknown> = {};
      template.columns.forEach((col) => { filtered[col] = row[col as keyof typeof row]; });
      return filtered;
    });
  }, [template, moduleData]);

  const chartData = useMemo(() => {
    if (!template?.chartColumn || template.chartType === 'none') return [];
    const counts: Record<string, number> = {};
    reportData.forEach((row) => {
      const key = String(row[template.chartColumn!] ?? 'Unknown');
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [reportData, template]);

  const createTemplate = async () => {
    if (!canManage || !user) return;
    const parsed = reportTemplateFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid form');
      return;
    }
    setSaving(true);
    const result = await createReportTemplate(user.id, parsed.data);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to save template');
      return;
    }
    setSelectedId(result.data.id);
    setDialogOpen(false);
    setForm({ name: '', table: 'criticalValues', chartType: 'bar', chartColumn: '' });
    toast.success('Report template saved');
    void loadTemplates();
  };

  const exportExcel = () => {
    if (!template) return;
    downloadCSV(`${template.name.replace(/\s+/g, '-').toLowerCase()}.csv`, template.columns, reportData.map((r) => template.columns.map((c) => String(r[c] ?? ''))));
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

  const deleteTemplate = async (id: string) => {
    if (!canManage || !user || !confirm(tc('confirmDelete'))) return;
    const result = await softDeleteReportTemplate(id, user.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setSelectedId(templates.find((t) => t.id !== id)?.id ?? null);
    toast.success('Template deleted');
    void loadTemplates();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
                  <Select value={form.table} onValueChange={(v) => setForm({ ...form, table: v as ReportTemplateFormData['table'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(REPORT_MODULES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Chart Type</Label>
                  <Select value={form.chartType ?? 'bar'} onValueChange={(v) => setForm({ ...form, chartType: v as ReportTemplateFormData['chartType'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bar">Bar Chart</SelectItem>
                      <SelectItem value="pie">Pie Chart</SelectItem>
                      <SelectItem value="none">No Chart</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={createTemplate} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tc('save')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {error && <EmptyState title="Failed to load templates" description={error} />}

      <div className="grid lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Templates</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {templates.map((t) => (
              <button key={t.id} onClick={() => setSelectedId(t.id)} className={`w-full text-start rounded-lg px-3 py-2 text-sm flex items-center justify-between ${selectedId === t.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}>
                {t.name}
                {canManage && <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); void deleteTemplate(t.id); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>}
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
                <p className="text-sm text-muted-foreground mb-4">
                  {dataLoading ? 'Loading records…' : `${reportData.length} records from ${REPORT_MODULES[template.table as keyof typeof REPORT_MODULES]?.label ?? template.table}`}
                </p>

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
