'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { Archive, Copy, Eye, GitBranchPlus, Loader2, Pencil, Search, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/components/providers/auth-provider';
import {
  createNewFillablePdfVersion,
  duplicateFillablePdfTemplate,
  fetchArchiveCountsByTemplate,
  fetchFillablePdfTemplates,
  publishFillablePdfTemplate,
  retireFillablePdfTemplate,
} from '@/lib/fillable-pdf/templates';
import {
  canAccessFillableFormArchive,
  canBuildForms,
  canPublishForms,
  canSubmitForms,
  canViewPublishedForms,
} from '@/lib/forms/permissions';
import type { FillablePdfTemplate } from '@/types/modules';
import { toast } from 'sonner';

const STATUS_VARIANT = { draft: 'secondary', published: 'default', archived: 'outline' } as const;

export default function FillableFormsPage() {
  const locale = useLocale();
  const { can, user } = useAuth();
  const canDesign = canBuildForms(can);
  const canPublish = canPublishForms(can);
  const canFill = canSubmitForms(can);
  const canView = canViewPublishedForms(can);
  const canArchive = canAccessFillableFormArchive(can);

  const accessDenied = !canView && !canDesign;
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const [templates, setTemplates] = useState<FillablePdfTemplate[]>([]);
  const [archiveCounts, setArchiveCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [result, counts] = await Promise.all([
      fetchFillablePdfTemplates(),
      canArchive ? fetchArchiveCountsByTemplate() : Promise.resolve({}),
    ]);
    setTemplates(result.data);
    setArchiveCounts(counts);
    setError(result.error);
    setLoading(false);
  }, [canArchive]);

  useEffect(() => {
    if (!accessDenied) void load();
  }, [accessDenied, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const visible = canDesign ? templates : templates.filter((t) => t.status === 'published' || t.isPublished);
    if (!q) return visible;
    return visible.filter((t) =>
      t.title.toLowerCase().includes(q)
      || t.formNumber?.toLowerCase().includes(q),
    );
  }, [templates, search, canDesign]);

  if (accessDenied) return null;

  const handlePublish = async (template: FillablePdfTemplate) => {
    if (!user || !canPublish) return;
    setBusyId(template.id);
    const result = await publishFillablePdfTemplate(template, user.id);
    setBusyId(null);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Template published');
      void load();
    }
  };

  const handleRetire = async (template: FillablePdfTemplate) => {
    if (!user || !canPublish) return;
    setBusyId(template.id);
    const result = await retireFillablePdfTemplate(template, user.id);
    setBusyId(null);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Template retired');
      void load();
    }
  };

  const handleDuplicate = async (template: FillablePdfTemplate) => {
    if (!user || !canDesign) return;
    setBusyId(template.id);
    const result = await duplicateFillablePdfTemplate(template, user.id);
    setBusyId(null);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Template duplicated as new draft');
      void load();
    }
  };

  const handleNewVersion = async (template: FillablePdfTemplate) => {
    if (!user || !canDesign) return;
    setBusyId(template.id);
    const result = await createNewFillablePdfVersion(template, user.id);
    setBusyId(null);
    if (result.error) toast.error(result.error);
    else {
      toast.success(`Created v${template.version + 1} draft`);
      void load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fillable Forms</h1>
          <p className="text-muted-foreground">PDF templates with positioned fields for electronic documentation</p>
        </div>
        {canDesign && (
          <Button asChild>
            <Link href={`/${locale}/fillable-forms/new`}>
              <Upload className="h-4 w-4 me-2" />Upload PDF Form
            </Link>
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="ps-9" placeholder="Search templates..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
      {error && <EmptyState title="Failed to load templates" description={error} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title="No fillable templates"
          description={canDesign ? 'Upload a PDF to create your first fillable form.' : 'Published PDF templates will appear here.'}
          action={canDesign ? (
            <Button asChild><Link href={`/${locale}/fillable-forms/new`}>Upload PDF Form</Link></Button>
          ) : undefined}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((template) => {
          const count = archiveCounts[template.id] ?? 0;
          return (
            <Card key={template.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{template.title}</CardTitle>
                  <Badge variant={STATUS_VARIANT[template.status]} className="capitalize shrink-0">{template.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {template.formNumber ?? 'No form number'} · v{template.version}
                </p>
                {template.category && <p className="text-xs text-muted-foreground">{template.category}</p>}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground truncate">Source: {template.sourcePdfName ?? template.sourcePdfPath}</p>
                <p className="text-xs text-muted-foreground">Updated {new Date(template.updatedAt).toLocaleString()}</p>
                <div className="flex flex-wrap gap-2">
                  {canDesign && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/${locale}/fillable-forms/design/${template.id}`}><Pencil className="h-3.5 w-3.5 me-1" />Design</Link>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/${locale}/fillable-forms/fill/${template.id}?preview=1`}><Eye className="h-3.5 w-3.5 me-1" />Preview</Link>
                  </Button>
                  {canArchive && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/${locale}/fillable-forms/archive/${template.id}`}>
                        <Archive className="h-3.5 w-3.5 me-1" />
                        Archive{count > 0 ? ` (${count})` : ''}
                      </Link>
                    </Button>
                  )}
                  {(template.status === 'published' || template.isPublished) && canFill && (
                    <Button asChild size="sm">
                      <Link href={`/${locale}/fillable-forms/fill/${template.id}`}>Fill</Link>
                    </Button>
                  )}
                  {canDesign && (
                    <>
                      <Button size="sm" variant="ghost" disabled={busyId === template.id} onClick={() => void handleDuplicate(template)}>
                        <Copy className="h-3.5 w-3.5 me-1" />Duplicate
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busyId === template.id} onClick={() => void handleNewVersion(template)}>
                        <GitBranchPlus className="h-3.5 w-3.5 me-1" />New Version
                      </Button>
                    </>
                  )}
                  {canPublish && template.status !== 'archived' && (
                    <>
                      {template.status !== 'published' && (
                        <Button size="sm" variant="ghost" disabled={busyId === template.id} onClick={() => void handlePublish(template)}>Publish</Button>
                      )}
                      <Button size="sm" variant="ghost" disabled={busyId === template.id} onClick={() => void handleRetire(template)}>
                        Retire
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
