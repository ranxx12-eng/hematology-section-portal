'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { getNavIcon } from '@/lib/cms/icons';
import { MEDICAL_REPORT_SECTIONS, MEDICAL_REPORTS_LANDING } from '@/lib/medical-reports/constants';
import { canViewMedicalReports } from '@/lib/medical-reports/permissions';
import { useAuth } from '@/components/providers/auth-provider';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function MedicalReportsLandingPage() {
  const locale = useLocale();
  const { can } = useAuth();
  const accessDenied = !canViewMedicalReports(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  return (
    <PageContentSections
      pageKey="dashboard"
      fallbackTitle={MEDICAL_REPORTS_LANDING.title}
      fallbackSubtitle={MEDICAL_REPORTS_LANDING.subtitle}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MEDICAL_REPORT_SECTIONS.map((section) => {
          const Icon = getNavIcon(section.navIcon);
          return (
            <Card key={section.key} className="flex h-full flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-base leading-snug">{section.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                <Button asChild className="w-full sm:w-auto">
                  <Link href={`/${locale}${section.href}`}>
                    Open
                    <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageContentSections>
  );
}
