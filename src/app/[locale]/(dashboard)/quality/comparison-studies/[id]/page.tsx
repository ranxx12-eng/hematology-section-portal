'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { SpecializedStudyPlaceholder } from '@/components/comparison-studies/specialized-study-placeholder';
import { StandardComparisonForm } from '@/components/comparison-studies/standard-comparison-form';
import { Button } from '@/components/ui/button';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { fetchComparisonStudyById } from '@/lib/clinical/comparison-studies';
import { canViewComparisonStudies } from '@/lib/comparison-studies/permissions';
import type { ComparisonStudy } from '@/types/comparison-study';

export default function ComparisonStudyDetailPage() {
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const { can, user } = useAuth();
  const accessDenied = !canViewComparisonStudies(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const [loading, setLoading] = useState(true);
  const [study, setStudy] = useState<ComparisonStudy | null>(null);

  const reload = useCallback(async () => {
    if (!params.id) return;
    setLoading(true);
    const result = await fetchComparisonStudyById(params.id);
    setStudy(result.data);
    setLoading(false);
    if (result.error) toast.error(result.error);
  }, [params.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!study || !user) {
    return (
      <PageContentSections pageKey="dashboard" fallbackTitle="Comparison Study">
        <p className="text-muted-foreground">Study not found.</p>
      </PageContentSections>
    );
  }

  return (
    <PageContentSections pageKey="dashboard" fallbackTitle="Comparison Study">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${locale}/quality/comparison-studies`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{study.studyTitle || study.studyNumber}</h1>
            <p className="text-muted-foreground">{study.studyNumber}</p>
          </div>
        </div>

        {study.studyType === 'standard_comparison' ? (
          <StandardComparisonForm
            study={study}
            user={user}
            can={can}
            onRefresh={(updated) => setStudy(updated)}
          />
        ) : (
          <SpecializedStudyPlaceholder
            studyType={study.studyType}
            studyNumber={study.studyNumber}
            status={study.status}
          />
        )}
      </div>
    </PageContentSections>
  );
}
