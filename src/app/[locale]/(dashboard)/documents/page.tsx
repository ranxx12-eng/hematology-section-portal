'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { statusBadgeVariant } from '@/lib/page-utils';
import { formatDate } from '@/lib/utils';
import {
  createDocument,
  fetchDocuments,
  softDeleteDocument,
} from '@/lib/clinical/documents';
import {
  DOCUMENT_CATEGORIES,
  documentFormSchema,
  emptyDocumentForm,
  type DocumentFormData,
} from '@/lib/documents/schema';
import type { Document } from '@/types';

export default function DocumentsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('documents.manage');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<DocumentFormData>(() => emptyDocumentForm());

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchDocuments();
    setDocuments(result.data);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const accessDenied = !can('documents.view');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  const filtered = useMemo(() => {
    if (category === 'all') return documents;
    return documents.filter((d) => d.category === category);
  }, [documents, category]);

  const addDocument = async () => {
    if (!canManage || !user) return;
    const parsed = documentFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid form');
      return;
    }
    setSaving(true);
    const result = await createDocument(user.id, parsed.data);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to add document');
      return;
    }
    setDialogOpen(false);
    setForm(emptyDocumentForm());
    toast.success('Document added');
    void loadDocuments();
  };

  const deleteDocument = async (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    const result = await softDeleteDocument(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Document deleted');
    void loadDocuments();
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
          <p className="text-muted-foreground">{documents.length} documents</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{tc('add')}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{tc('add')} Document</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Document Number</Label><Input value={form.documentNumber ?? ''} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} placeholder="Auto-generated if empty" /></div>
                <div><Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DOCUMENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Version</Label><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></div>
                <Button onClick={addDocument} className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tc('save')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <EmptyState title="Failed to load documents" description={error} />
      ) : (
        <Tabs value={category} onValueChange={setCategory}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            {DOCUMENT_CATEGORIES.map((c) => <TabsTrigger key={c} value={c}>{c}</TabsTrigger>)}
          </TabsList>
          <TabsContent value={category}>
            {filtered.length === 0 ? (
              <EmptyState title={tc('noData')} description="No documents in this category." />
            ) : (
              <DataTable data={filtered} columns={columns} searchKey="title" searchPlaceholder="Search documents..." />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
