'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { Loader2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchPublishedForms } from '@/lib/clinical/forms';
import { canAccessElectronicForms, canSubmitForms } from '@/lib/forms/permissions';
import type { DynamicForm } from '@/types/modules';

export default function ElectronicFormsPage() {
  const locale = useLocale();
  const { can } = useAuth();
  const [forms, setForms] = useState<DynamicForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const accessDenied = !canAccessElectronicForms(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const loadForms = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPublishedForms();
    setForms(result.data);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!accessDenied) void loadForms();
  }, [accessDenied, loadForms]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return forms;
    return forms.filter((form) =>
      form.title.toLowerCase().includes(q)
      || form.formNumber?.toLowerCase().includes(q)
      || form.category?.toLowerCase().includes(q),
    );
  }, [forms, search]);

  if (accessDenied) return null;

  const canFill = canSubmitForms(can);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Electronic Forms</h1>
        <p className="text-muted-foreground">Open and complete published laboratory forms</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="ps-9"
          placeholder="Search by title, form number, or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && <EmptyState title="Failed to load forms" description={error} />}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title="No published forms"
          description="Published forms will appear here when they are available."
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((form) => (
          <Card key={form.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{form.title}</CardTitle>
                <Badge className="capitalize shrink-0">published</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {form.formNumber ? `Form ${form.formNumber}` : 'No form number'} · v{form.version}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{form.description}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {form.category ?? 'General'}
                {form.effectiveDate ? ` · Effective ${form.effectiveDate}` : ''}
              </p>
              {canFill ? (
                <Button asChild className="w-full">
                  <Link href={`/${locale}/form-builder/fill/${form.id}`}>Open Form</Link>
                </Button>
              ) : (
                <Button variant="outline" className="w-full" disabled>
                  View only — submission not permitted
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
