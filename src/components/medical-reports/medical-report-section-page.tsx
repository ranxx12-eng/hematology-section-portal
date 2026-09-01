'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { History, Plus, Printer, Search } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import type { MedicalReportSectionDefinition } from '@/lib/medical-reports/constants';
import {
  canCreateMedicalReports,
  canPrintMedicalReports,
  canViewMedicalReports,
} from '@/lib/medical-reports/permissions';
import { useAuth } from '@/components/providers/auth-provider';
import { useRouteReplace } from '@/hooks/use-route-replace';

interface MedicalReportSectionPageProps {
  section: MedicalReportSectionDefinition;
}

function notifyPending(action: string) {
  toast.info(`${action} will be available when the official controlled form is provided.`);
}

export function MedicalReportSectionPage({ section }: MedicalReportSectionPageProps) {
  const locale = useLocale();
  const { can } = useAuth();
  const accessDenied = !canViewMedicalReports(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  const canCreate = canCreateMedicalReports(can);
  const canPrint = canPrintMedicalReports(can);

  return (
    <PageContentSections
      pageKey="dashboard"
      fallbackTitle={section.title}
      fallbackSubtitle={section.subtitle}
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            className="w-full sm:w-auto"
            disabled={!canCreate}
            onClick={() => notifyPending(section.newActionLabel)}
            aria-label={section.newActionLabel}
          >
            <Plus className="me-2 h-4 w-4" aria-hidden="true" />
            {section.newActionLabel}
          </Button>
          {section.showSearch && (
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => notifyPending('Search')}
              aria-label="Search reports"
            >
              <Search className="me-2 h-4 w-4" aria-hidden="true" />
              Search
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => notifyPending(section.historyActionLabel)}
            aria-label={section.historyActionLabel}
          >
            <History className="me-2 h-4 w-4" aria-hidden="true" />
            {section.historyActionLabel}
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            disabled={!canPrint}
            onClick={() => notifyPending('Print / PDF')}
            aria-label="Print or export PDF"
          >
            <Printer className="me-2 h-4 w-4" aria-hidden="true" />
            Print / PDF
          </Button>
          <Button variant="ghost" asChild className="w-full sm:w-auto sm:ms-auto">
            <Link href={`/${locale}/medical-reports`}>Back to Medical Reports</Link>
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <EmptyState
              title={section.emptyTitle}
              description={section.emptyDescription}
            />
          </CardContent>
        </Card>
      </div>
    </PageContentSections>
  );
}
