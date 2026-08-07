'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog, statusBadgeVariant } from '@/lib/page-utils';
import { formatDate, generateId } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Risk, CAPARecord } from '@/types';

function RiskMatrix({ risks }: { risks: Risk[] }) {
  const matrix = useMemo(() => {
    const grid: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
    risks.forEach((r) => {
      const l = Math.min(Math.max(r.likelihood, 1), 5) - 1;
      const s = Math.min(Math.max(r.severity, 1), 5) - 1;
      grid[4 - l][s]++;
    });
    return grid;
  }, [risks]);

  const getColor = (l: number, s: number) => {
    const score = (5 - l) * (s + 1);
    if (score >= 15) return 'bg-red-500 text-white';
    if (score >= 8) return 'bg-amber-400 text-amber-900';
    return 'bg-emerald-400 text-emerald-900';
  };

  return (
    <Card>
      <CardHeader><CardTitle>Risk Matrix (Likelihood × Severity)</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="p-2" />
                {[1, 2, 3, 4, 5].map((s) => <th key={s} className="p-2 text-center">S{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, li) => (
                <tr key={li}>
                  <td className="p-2 font-medium">L{5 - li}</td>
                  {row.map((count, si) => (
                    <td key={si} className="p-1">
                      <div className={cn('w-12 h-12 rounded flex items-center justify-center font-bold', getColor(li, si))}>
                        {count || '·'}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RiskCapaPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManageRisk = can('risk.manage');
  const canManageCapa = can('capa.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [riskDialog, setRiskDialog] = useState(false);
  const [capaDialog, setCapaDialog] = useState(false);
  const [riskForm, setRiskForm] = useState({ title: '', category: 'Operational', likelihood: '3', severity: '3' });
  const [capaForm, setCapaForm] = useState({ source: '', problemStatement: '' });
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  const accessDenied = !can('risk.view') && !can('capa.view');


  useRouteReplace(accessDenied, `/${locale}/unauthorized`);


  if (accessDenied) return null;

  const addRisk = () => {
    if (!riskForm.title || !canManageRisk) return;
    const now = new Date().toISOString();
    const l = parseInt(riskForm.likelihood, 10);
    const s = parseInt(riskForm.severity, 10);
    const risk: Risk = {
      id: generateId(),
      title: riskForm.title,
      category: riskForm.category,
      description: 'Risk description',
      likelihood: l,
      severity: s,
      riskScore: l * s,
      ownerId: user?.id || db.employees[0]?.id || '',
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      status: 'open',
      createdAt: now,
    };
    db.risks.unshift(risk);
    if (user) appendAuditLog(db, user.id, 'create', 'risk', risk.id);
    saveMockDatabase(db);
    refresh();
    setRiskDialog(false);
    toast.success('Risk added');
  };

  const addCapa = () => {
    if (!capaForm.problemStatement || !canManageCapa) return;
    const now = new Date().toISOString();
    const capa: CAPARecord = {
      id: generateId(),
      source: capaForm.source || 'Manual',
      problemStatement: capaForm.problemStatement,
      ownerId: user?.id || db.employees[0]?.id || '',
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      status: 'open',
      createdAt: now,
    };
    db.capaRecords.unshift(capa);
    if (user) appendAuditLog(db, user.id, 'create', 'capa', capa.id);
    saveMockDatabase(db);
    refresh();
    setCapaDialog(false);
    toast.success('CAPA record added');
  };

  const deleteRisk = (id: string) => {
    if (!canManageRisk || !confirm(tc('confirmDelete'))) return;
    db.risks = db.risks.filter((r) => r.id !== id);
    if (user) appendAuditLog(db, user.id, 'delete', 'risk', id);
    saveMockDatabase(db);
    refresh();
    toast.success('Risk deleted');
  };

  const deleteCapa = (id: string) => {
    if (!canManageCapa || !confirm(tc('confirmDelete'))) return;
    db.capaRecords = db.capaRecords.filter((c) => c.id !== id);
    if (user) appendAuditLog(db, user.id, 'delete', 'capa', id);
    saveMockDatabase(db);
    refresh();
    toast.success('CAPA deleted');
  };

  const riskColumns: ColumnDef<Risk>[] = useMemo(() => [
    { accessorKey: 'title', header: 'Risk' },
    { accessorKey: 'category', header: 'Category' },
    { accessorKey: 'likelihood', header: 'L' },
    { accessorKey: 'severity', header: 'S' },
    { accessorKey: 'riskScore', header: 'Score', cell: ({ row }) => <Badge variant={row.original.riskScore >= 15 ? 'destructive' : row.original.riskScore >= 8 ? 'warning' : 'success'}>{row.original.riskScore}</Badge> },
    { accessorKey: 'dueDate', header: 'Due', cell: ({ row }) => formatDate(row.original.dueDate, locale) },
    { accessorKey: 'status', header: tc('status'), cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status.replace('_', ' ')}</Badge> },
    {
      id: 'actions', header: tc('actions'),
      cell: ({ row }) => canManageRisk ? (
        <Button size="sm" variant="ghost" onClick={() => deleteRisk(row.original.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
      ) : null,
    },
  ], [canManageRisk, locale, tc]);

  const capaColumns: ColumnDef<CAPARecord>[] = useMemo(() => [
    { accessorKey: 'source', header: 'Source' },
    { accessorKey: 'problemStatement', header: 'Problem' },
    { accessorKey: 'dueDate', header: 'Due', cell: ({ row }) => formatDate(row.original.dueDate, locale) },
    { accessorKey: 'status', header: tc('status'), cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status.replace('_', ' ')}</Badge> },
    {
      id: 'actions', header: tc('actions'),
      cell: ({ row }) => canManageCapa ? (
        <Button size="sm" variant="ghost" onClick={() => deleteCapa(row.original.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
      ) : null,
    },
  ], [canManageCapa, locale, tc]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tc('riskCapa')}</h1>
        <p className="text-muted-foreground">Risk register and CAPA management</p>
      </div>

      <Tabs defaultValue="risks">
        <TabsList>
          <TabsTrigger value="risks">Risks ({db.risks.length})</TabsTrigger>
          <TabsTrigger value="capa">CAPA ({db.capaRecords.length})</TabsTrigger>
          <TabsTrigger value="matrix">Risk Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="risks" className="space-y-4">
          {canManageRisk && (
            <Dialog open={riskDialog} onOpenChange={setRiskDialog}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{tc('add')} Risk</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{tc('add')} Risk</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Title</Label><Input value={riskForm.title} onChange={(e) => setRiskForm({ ...riskForm, title: e.target.value })} /></div>
                  <div><Label>Category</Label><Input value={riskForm.category} onChange={(e) => setRiskForm({ ...riskForm, category: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Likelihood (1-5)</Label><Input type="number" min={1} max={5} value={riskForm.likelihood} onChange={(e) => setRiskForm({ ...riskForm, likelihood: e.target.value })} /></div>
                    <div><Label>Severity (1-5)</Label><Input type="number" min={1} max={5} value={riskForm.severity} onChange={(e) => setRiskForm({ ...riskForm, severity: e.target.value })} /></div>
                  </div>
                  <Button onClick={addRisk} className="w-full">{tc('save')}</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <DataTable data={db.risks} columns={riskColumns} searchKey="title" />
        </TabsContent>

        <TabsContent value="capa" className="space-y-4">
          {canManageCapa && (
            <Dialog open={capaDialog} onOpenChange={setCapaDialog}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{tc('add')} CAPA</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{tc('add')} CAPA Record</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Source</Label><Input value={capaForm.source} onChange={(e) => setCapaForm({ ...capaForm, source: e.target.value })} /></div>
                  <div><Label>Problem Statement</Label><Input value={capaForm.problemStatement} onChange={(e) => setCapaForm({ ...capaForm, problemStatement: e.target.value })} /></div>
                  <Button onClick={addCapa} className="w-full">{tc('save')}</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <DataTable data={db.capaRecords} columns={capaColumns} searchKey="problemStatement" />
        </TabsContent>

        <TabsContent value="matrix">
          <RiskMatrix risks={db.risks} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
