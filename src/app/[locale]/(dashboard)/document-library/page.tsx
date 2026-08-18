'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { Download, History, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/components/providers/auth-provider';
import {
  createDocumentSignedUrl,
  fetchDocumentLibrary,
} from '@/lib/clinical/documents';
import type { DocumentLibraryItem } from '@/lib/documents/schema';
import { formatDate } from '@/lib/utils';

const CATEGORY_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'SOP', label: 'SOPs' },
  { key: 'Policy', label: 'Policies' },
  { key: 'Form', label: 'Forms' },
  { key: 'Manual', label: 'Manuals' },
];

export default function DocumentLibraryPage() {
  const locale = useLocale();
  const router = useRouter();
  const { can } = useAuth();
  const [documents, setDocuments] = useState<DocumentLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const allowed = can('documents.view');

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchDocumentLibrary();
    setDocuments(result.data);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (allowed) void loadDocuments();
  }, [allowed, loadDocuments]);

  useEffect(() => {
    if (!allowed) router.replace(`/${locale}/unauthorized`);
  }, [allowed, locale, router]);

  const docs = useMemo(
    () => documents.filter((d) => category === 'all' || d.category.toLowerCase().includes(category.toLowerCase())),
    [documents, category],
  );
  const selected = docs.find((d) => d.id === selectedId) ?? docs[0];
  const expiringSoon = useMemo(() => {
    const threshold = Date.now() + 30 * 86400000;
    return documents.filter((d) => d.expiryDate && new Date(d.expiryDate).getTime() < threshold);
  }, [documents]);

  if (!allowed) return null;

  const handleDownload = async (doc: DocumentLibraryItem) => {
    const currentVersion = doc.versions.find((v) => v.version === doc.currentVersion) ?? doc.versions[0];
    if (!currentVersion?.filePath) {
      toast.error('No file attached to this document version');
      return;
    }
    setDownloading(true);
    const result = await createDocumentSignedUrl(doc.category, currentVersion.filePath);
    setDownloading(false);
    if (result.error || !result.url) {
      toast.error(result.error ?? 'Failed to generate download link');
      return;
    }
    window.open(result.url, '_blank', 'noopener,noreferrer');
    toast.success(`Download started for ${doc.title} v${doc.currentVersion}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Document Library</h1>
        <p className="text-muted-foreground">Controlled documents with version history and secure downloads</p>
      </div>

      {expiringSoon.length > 0 && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <p className="text-sm">{expiringSoon.length} document(s) due for review within 30 days</p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <EmptyState title="Failed to load document library" description={error} />
      ) : (
        <Tabs value={category} onValueChange={setCategory}>
          <TabsList className="flex-wrap h-auto">
            {CATEGORY_FILTERS.map((c) => <TabsTrigger key={c.key} value={c.key}>{c.label}</TabsTrigger>)}
          </TabsList>

          <TabsContent value={category} className="mt-4">
            {docs.length === 0 ? (
              <EmptyState title="No documents" description="No documents match this filter." />
            ) : (
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
                        <Button size="sm" onClick={() => handleDownload(selected)} disabled={downloading}>
                          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 me-1" />}
                          Download
                        </Button>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4 text-sm">
                        <div><span className="font-medium">Version:</span> {selected.currentVersion}</div>
                        <div><span className="font-medium">Effective:</span> {formatDate(selected.effectiveDate, locale)}</div>
                        <div><span className="font-medium">Review Due:</span> {selected.expiryDate ? formatDate(selected.expiryDate, locale) : '—'}</div>
                        <div><span className="font-medium">Status:</span> {selected.status.replace('_', ' ')}</div>
                      </div>

                      <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2"><CheckCircle className="h-4 w-4 text-success" />Document Status</h3>
                        <p className="text-sm text-muted-foreground">Approval workflow is tracked via document status in the controlled documents register.</p>
                      </div>

                      <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2"><History className="h-4 w-4 text-accent" />Version History</h3>
                        {selected.versions.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No file versions uploaded yet.</p>
                        ) : selected.versions.map((v) => (
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
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
