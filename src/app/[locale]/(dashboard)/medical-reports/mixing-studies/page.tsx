'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { createMixingStudy, fetchMixingStudies } from '@/lib/clinical/mixing-studies';
import {
  MIXING_STUDY_STATUS_LABELS,
  formatMixingStaffLine,
} from '@/lib/medical-reports/form-hema-023/constants';
import { getMedicalReportSection } from '@/lib/medical-reports/constants';
import { canCreateMedicalReports, canViewMedicalReports } from '@/lib/medical-reports/permissions';
import type { MixingStudyListItem } from '@/types/mixing-study';

export default function MixingStudiesPage() {
  const locale = useLocale();
  const router = useRouter();
  const { can } = useAuth();
  const section = getMedicalReportSection('mixing-studies');
  const accessDenied = !canViewMedicalReports(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<MixingStudyListItem[]>([]);

  const reload = useCallback(async (search?: string) => {
    setLoading(true);
    const result = await fetchMixingStudies(search);
    setRecords(result.data);
    setLoading(false);
    if (result.error) toast.error(result.error);
  }, []);

  useEffect(() => {
    if (accessDenied) return;
    void reload();
  }, [accessDenied, reload]);

  if (accessDenied || !section) return null;

  const startNew = async () => {
    setCreating(true);
    const result = await createMixingStudy('both');
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Unable to create mixing study');
      setCreating(false);
      return;
    }
    router.push(`/${locale}/medical-reports/mixing-studies/${result.data.id}`);
  };

  return (
    <PageContentSections pageKey="dashboard" fallbackTitle={section.title} fallbackSubtitle={section.subtitle}>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="w-full sm:w-auto" disabled={!canCreateMedicalReports(can) || creating} onClick={() => void startNew()}>
            {creating ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
            New Mixing Study
          </Button>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by study number"
            aria-label="Search by study number"
            className="sm:max-w-xs"
          />
          <Button variant="outline" onClick={() => void reload(query)}>Search</Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : records.length === 0 ? (
          <EmptyState title={section.emptyTitle} description={section.emptyDescription} />
        ) : (
          <div className="grid gap-3">
            {records.map((record) => (
              <Card key={record.id}>
                <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <Link href={`/${locale}/medical-reports/mixing-studies/${record.id}`} className="font-medium hover:underline">
                      {record.studyNumber}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {record.studyDate} · {record.testSelection.toUpperCase()} · {record.sampleReferencePresent ? 'Sample reference on file' : 'No sample reference'}
                    </p>
                    <p className="text-sm">{formatMixingStaffLine('Performed By', record.performedByName, record.performedByStaffId)}</p>
                  </div>
                  <Badge variant={record.status === 'reviewed' ? 'default' : 'secondary'}>
                    {MIXING_STUDY_STATUS_LABELS[record.status]}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageContentSections>
  );
}
