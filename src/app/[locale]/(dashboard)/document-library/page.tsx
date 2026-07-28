'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { Download, History, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog } from '@/lib/page-utils';
import { formatDate } from '@/lib/utils';
import type { DocumentLibraryCategory } from '@/types/modules';

const CATEGORIES: { key: DocumentLibraryCategory; label: string }[] = [
  { key: 'sop', label: 'SOPs' },
  { key: 'policy', label: 'Policies' },
  { key: 'cap', label: 'CAP Documents' },
  { key: 'cbahi', label: 'CBAHI Documents' },
  { key: 'form', label: 'Forms' },
  { key: 'manual', label: 'Manuals' },
  { key: 'validation', label: 'Validation Reports' },
  { key: 'training', label: 'Training Material' },
];

export default function DocumentLibraryPage() {
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const [db, setDb] = useState(() => getMockDatabase());
  const [category, setCategory] = useState<DocumentLibraryCategory | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const refresh = useCallback(() => setDb(getMockDatabase()), []);
  const allowed = can('documents.view');

  useEffect(() => {
    if (!allowed) router.replace(`/${locale}/unauthorized`);
  }, [allowed, locale, router]);

  const docs = useMemo(() => db.libraryDocuments.filter((d) => category === 'all' || d.category === category), [db.libraryDocuments, category]);
  const selected = docs.find((d) => d.id === selectedId) ?? docs[0];
  const expiringSoon = useMemo(() => {
    const threshold = now + 30 * 86400000;
    return db.libraryDocuments.filter((d) => d.expiryDate && new Date(d.expiryDate).getTime() < threshold);
  }, [db.libraryDocuments, now]);

  if (!allowed) return null;

  const handleDownload = (docId: string) => {
    if (!user) return;
    const doc = db.libraryDocuments.find((d) => d.id === docId);
    if (!doc) return;
    doc.downloadHistory.push({ id: crypto.randomUUID(), documentId: docId, userId: user.id, downloadedAt: new Date().toISOString() });
    appendAuditLog(db, user.id, 'export', 'document_library', docId);
    saveMockDatabase(db);
    refresh();
    toast.success(`Downloaded ${doc.title} v${doc.currentVersion}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Document Library</h1>
        <p className="text-muted-foreground">SOPs, policies, CAP/CBAHI documents with version control and approval workflow</p>
      </div>

      {expiringSoon.length > 0 && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <p className="text-sm">{expiringSoon.length} document(s) expiring within 30 days</p>
          </CardContent>
        </Card>
      )}

      <Tabs value={category} onValueChange={(v) => setCategory(v as typeof category)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          {CATEGORIES.map((c) => <TabsTrigger key={c.key} value={c.key}>{c.label}</TabsTrigger>)}
        </TabsList>

        <TabsContent value={category} className="mt-4">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-2">
              {docs.map((doc) => (
                <button key={doc.id} onClick={() => setSelectedId(doc.id)} className={`w-full text-start rounded-lg border p-4 transition-colors ${selected?.id === doc.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  <p className="font-medium text-sm">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">{doc.documentNumber} · v{doc.currentVersion}</p>
                  <Badge variant={doc.status === 'approved' ? 'success' : 'warning'} className="mt-2 capitalize">{doc.status.replace('_', ' ')}</Badge>
                </button>
              ))}
            </div>

            {selected && (
              <Card className="lg:col-span-2">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold">{selected.title}</h2>
                      <p className="text-muted-foreground">{selected.documentNumber}</p>
                    </div>
                    <Button size="sm" onClick={() => handleDownload(selected.id)}><Download className="h-4 w-4 me-1" />Download</Button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div><span className="font-medium">Version:</span> {selected.currentVersion}</div>
                    <div><span className="font-medium">Effective:</span> {formatDate(selected.effectiveDate, locale)}</div>
                    <div><span className="font-medium">Expiry:</span> {selected.expiryDate ? formatDate(selected.expiryDate, locale) : '—'}</div>
                    <div><span className="font-medium">Downloads:</span> {selected.downloadHistory.length}</div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2"><CheckCircle className="h-4 w-4 text-success" />Approval Workflow</h3>
                    <div className="space-y-2">
                      {selected.approvalWorkflow.map((step, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm rounded-lg border border-border p-3">
                          <Badge variant={step.status === 'approved' ? 'success' : 'warning'}>{step.status}</Badge>
                          <span>{step.step}</span>
                          {step.date && <span className="text-muted-foreground ms-auto">{formatDate(step.date, locale)}</span>}
                        </div>
                      ))}
                      {selected.approvalWorkflow.length === 0 && <p className="text-sm text-muted-foreground">No approval steps recorded</p>}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2"><History className="h-4 w-4 text-accent" />Version History</h3>
                    {selected.versions.map((v) => (
                      <div key={v.version} className="text-sm rounded-lg border border-border p-3 mb-2">
                        <p className="font-medium">v{v.version} — {v.fileName}</p>
                        <p className="text-muted-foreground text-xs">{v.changeNotes ?? 'No notes'} · {formatDate(v.uploadedAt, locale)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
