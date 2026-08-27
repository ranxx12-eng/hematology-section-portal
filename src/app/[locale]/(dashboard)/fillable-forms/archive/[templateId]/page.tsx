'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { ArrowLeft, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchFillablePdfTemplateById, resolveCompletedPdfUrl } from '@/lib/fillable-pdf/templates';
import { fetchFillablePdfSubmissions } from '@/lib/fillable-pdf/submissions';
import { canAccessFillableFormArchive } from '@/lib/forms/permissions';
import type { FillablePdfSubmission, FillablePdfTemplate } from '@/types/modules';

const ALL = '__all__';

export default function FillableFormArchivePage() {
  const params = useParams<{ templateId: string }>();
  const locale = useLocale();
  const { can } = useAuth();
  const canArchive = canAccessFillableFormArchive(can);
  const accessDenied = !canArchive;
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const [template, setTemplate] = useState<FillablePdfTemplate | null>(null);
  const [submissions, setSubmissions] = useState<FillablePdfSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState(ALL);
  const [monthFilter, setMonthFilter] = useState(ALL);
  const [submittedByFilter, setSubmittedByFilter] = useState('');
  const [staffIdFilter, setStaffIdFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [templateResult, submissionResult] = await Promise.all([
      fetchFillablePdfTemplateById(params.templateId),
      fetchFillablePdfSubmissions(params.templateId),
    ]);
    setTemplate(templateResult.data);
    setSubmissions(submissionResult.data);
    setError(templateResult.error ?? submissionResult.error);
    setLoading(false);
  }, [params.templateId]);

  useEffect(() => {
    if (!accessDenied) void load();
  }, [accessDenied, load]);

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const s of submissions) set.add(new Date(s.submittedAt).getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [submissions]);

  const months = useMemo(() => {
    const set = new Set<number>();
    for (const s of submissions) {
      const d = new Date(s.submittedAt);
      if (yearFilter === ALL || d.getFullYear() === Number(yearFilter)) {
        set.add(d.getMonth() + 1);
      }
    }
    return [...set].sort((a, b) => b - a);
  }, [submissions, yearFilter]);

  const filtered = useMemo(() => {
    const byName = submittedByFilter.trim().toLowerCase();
    const byStaff = staffIdFilter.trim().toLowerCase();
    return submissions.filter((s) => {
      const d = new Date(s.submittedAt);
      if (yearFilter !== ALL && d.getFullYear() !== Number(yearFilter)) return false;
      if (monthFilter !== ALL && d.getMonth() + 1 !== Number(monthFilter)) return false;
      if (byName && !(s.submittedByName ?? '').toLowerCase().includes(byName)) return false;
      if (byStaff && !(s.submittedByStaffId ?? '').toLowerCase().includes(byStaff)) return false;
      return true;
    });
  }, [submissions, yearFilter, monthFilter, submittedByFilter, staffIdFilter]);

  if (accessDenied) return null;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (error || !template) {
    return <EmptyState title="Archive unavailable" description={error ?? 'Template not found.'} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" className="px-0 mb-2">
          <Link href={`/${locale}/fillable-forms`}><ArrowLeft className="h-4 w-4 me-2" />Back to Fillable Forms</Link>
        </Button>
        <h1 className="text-2xl font-bold">{template.title}</h1>
        <p className="text-muted-foreground">
          {template.formNumber ?? 'No form number'} · v{template.version} · Archive
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Year</Label>
            <Select value={yearFilter} onValueChange={(v) => { setYearFilter(v); setMonthFilter(ALL); }}>
              <SelectTrigger><SelectValue placeholder="All years" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All years</SelectItem>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Month</Label>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger><SelectValue placeholder="All months" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All months</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {new Date(2000, m - 1, 1).toLocaleString(undefined, { month: 'long' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Submitted By</Label>
            <Input value={submittedByFilter} onChange={(e) => setSubmittedByFilter(e.target.value)} placeholder="Name" />
          </div>
          <div>
            <Label>Staff ID</Label>
            <Input value={staffIdFilter} onChange={(e) => setStaffIdFilter(e.target.value)} placeholder="Staff ID" />
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState title="No archived files" description="Completed submissions for this form will appear here." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-start p-3 font-medium">Date</th>
                <th className="text-start p-3 font-medium">Time</th>
                <th className="text-start p-3 font-medium">Submitted By</th>
                <th className="text-start p-3 font-medium">Staff ID</th>
                <th className="text-start p-3 font-medium">Version</th>
                <th className="text-start p-3 font-medium">Archive Status</th>
                <th className="text-start p-3 font-medium">File</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const d = new Date(s.submittedAt);
                return (
                  <tr key={s.id} className="border-t">
                    <td className="p-3">{d.toLocaleDateString()}</td>
                    <td className="p-3">{d.toLocaleTimeString()}</td>
                    <td className="p-3">{s.submittedByName ?? '—'}</td>
                    <td className="p-3">{s.submittedByStaffId ?? '—'}</td>
                    <td className="p-3">v{s.templateVersion}</td>
                    <td className="p-3"><Badge variant="secondary" className="capitalize">{s.status}</Badge></td>
                    <td className="p-3">
                      <Button asChild size="sm" variant="outline">
                        <a href={resolveCompletedPdfUrl(s.id)} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 me-1" />View PDF
                        </a>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {years.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Browse by period</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {years.map((y) => (
              <div key={y}>
                <p className="font-medium">{y}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {[...new Set(submissions.filter((s) => new Date(s.submittedAt).getFullYear() === y).map((s) => new Date(s.submittedAt).getMonth() + 1))]
                    .sort((a, b) => b - a)
                    .map((m) => (
                      <Button
                        key={`${y}-${m}`}
                        size="sm"
                        variant="ghost"
                        onClick={() => { setYearFilter(String(y)); setMonthFilter(String(m)); }}
                      >
                        {new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'long' })}
                      </Button>
                    ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
