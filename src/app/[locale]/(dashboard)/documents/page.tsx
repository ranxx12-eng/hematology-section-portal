'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog, statusBadgeVariant } from '@/lib/page-utils';
import { formatDate, generateId } from '@/lib/utils';
import type { Document } from '@/types';

const CATEGORIES = ['SOP', 'Policy', 'Form', 'Checklist', 'Manual'];

export default function DocumentsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('documents.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [category, setCategory] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', documentNumber: '', category: 'SOP', version: '1.0' });
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  if (!can('documents.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const filtered = useMemo(() => {
    if (category === 'all') return db.documents;
    return db.documents.filter((d) => d.category === category);
  }, [db.documents, category]);

  const addDocument = () => {
    if (!form.title || !canManage) return;
    const now = new Date().toISOString();
    const doc: Document = {
      id: generateId(),
      documentNumber: form.documentNumber || `SOP-HEM-${Date.now()}`,
      title: form.title,
      category: form.category,
      version: form.version,
      effectiveDate: now,
      reviewDate: new Date(Date.now() + 180 * 86400000).toISOString(),
      ownerId: user?.id || db.employees[0]?.id || '',
      status: 'draft',
      createdAt: now,
    };
    db.documents.unshift(doc);
    if (user) appendAuditLog(db, user.id, 'create', 'documents', doc.id);
    saveMockDatabase(db);
    refresh();
    setDialogOpen(false);
    toast.success('Document added');
  };

  const deleteDocument = (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    db.documents = db.documents.filter((d) => d.id !== id);
    if (user) appendAuditLog(db, user.id, 'delete', 'documents', id);
    saveMockDatabase(db);
    refresh();
    toast.success('Document deleted');
  };

  const columns: ColumnDef<Document>[] = useMemo(() => [
    { accessorKey: 'documentNumber', header: 'Doc #' },
    { accessorKey: 'title', header: 'Title' },
    { accessorKey: 'category', header: 'Category', cell: ({ row }) => <Badge variant="outline">{row.original.category}</Badge> },
    { accessorKey: 'version', header: 'Version' },
    { accessorKey: 'effectiveDate', header: 'Effective', cell: ({ row }) => formatDate(row.original.effectiveDate, locale) },
    { accessorKey: 'status', header: tc('status'), cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status.replace('_', ' ')}</Badge> },
    {
      id: 'actions', header: tc('actions'),
      cell: ({ row }) => canManage ? (
        <Button size="sm" variant="ghost" onClick={() => deleteDocument(row.original.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
      ) : null,
    },
  ], [canManage, locale, tc]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('documents')}</h1>
          <p className="text-muted-foreground">{db.documents.length} documents</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{tc('add')}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{tc('add')} Document</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Document Number</Label><Input value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} placeholder="Auto-generated if empty" /></div>
                <div><Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Version</Label><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></div>
                <Button onClick={addDocument} className="w-full">{tc('save')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={category} onValueChange={setCategory}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {CATEGORIES.map((c) => <TabsTrigger key={c} value={c}>{c}</TabsTrigger>)}
        </TabsList>
        <TabsContent value={category}>
          <DataTable data={filtered} columns={columns} searchKey="title" searchPlaceholder="Search documents..." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
