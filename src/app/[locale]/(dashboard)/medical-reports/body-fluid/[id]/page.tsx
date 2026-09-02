'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Download, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { BodyFluidWorksheetForm } from '@/components/medical-reports/body-fluid-worksheet-form';
import { StaffIdentity } from '@/components/shared/staff-identity';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useRouteReplace } from '@/hooks/use-route-replace';
import {
  fetchBodyFluidWorksheetById,
  logBodyFluidWorksheetPrinted,
  saveBodyFluidWorksheetDraft,
  submitBodyFluidWorksheet,
} from '@/lib/clinical/body-fluid-worksheets';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import type { BodyFluidWorksheetFormData } from '@/lib/medical-reports/body-fluid-schema';
import {
  canCreateMedicalReports,
  canEditMedicalReports,
  canPrintMedicalReports,
  canViewMedicalReports,
} from '@/lib/medical-reports/permissions';
import { downloadBodyFluidForm010Pdf } from '@/lib/print/body-fluid-form-010-pdf';
import { CONTROLLED_FORM_PRINT_LABEL } from '@/lib/print/controlled-form';
import { formatDateTime } from '@/lib/utils';
import type { BodyFluidWorksheet } from '@/types/body-fluid-worksheet';

function BodyFluidDetailContent() {
  const params = useParams<{ id: string }>();
  const locale = useLocale();
  const { can, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [worksheet, setWorksheet] = useState<BodyFluidWorksheet | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await fetchBodyFluidWorksheetById(params.id);
    setWorksheet(result.data);
    setLoading(false);
    if (result.error) toast.error(result.error);
  }, [params.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const editable = worksheet?.status === 'draft'
    && (canCreateMedicalReports(can) || canEditMedicalReports(can));

  const handleSave = async (form: BodyFluidWorksheetFormData) => {
    if (!user) return;
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await saveBodyFluidWorksheetDraft(params.id, staff, form);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Draft saved');
      setWorksheet(result.data);
    }
    setSaving(false);
  };

  const handleSubmit = async (form: BodyFluidWorksheetFormData) => {
    if (!user) return;
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await submitBodyFluidWorksheet(params.id, staff, form);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Worksheet submitted');
      setWorksheet(result.data);
    }
    setSaving(false);
  };

  const handlePrint = async () => {
    if (!worksheet || !user) return;
    if (!canPrintMedicalReports(can) && !canViewMedicalReports(can)) {
      toast.error('You do not have permission to print this worksheet.');
      return;
    }
    await downloadBodyFluidForm010Pdf(worksheet);
    const staff = await resolveStaffContext(user);
    await logBodyFluidWorksheetPrinted(params.id, staff);
  };

  if (loading || !worksheet) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" asChild>
          <Link href={`/${locale}/medical-reports/body-fluid`}>Back to History</Link>
        </Button>
        <Button variant="outline" onClick={() => void handlePrint()}>
          <Printer className="h-4 w-4 me-2" />
          {CONTROLLED_FORM_PRINT_LABEL}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Body Fluid Worksheet
            <Badge variant={worksheet.status === 'submitted' ? 'default' : 'secondary'}>
              {worksheet.status === 'submitted' ? 'Submitted' : 'Draft'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 text-sm">
          <div>
            <span className="font-medium">Primary Tech:</span>{' '}
            <StaffIdentity
              fullName={worksheet.primaryTechName}
              staffId={worksheet.primaryTechStaffId}
            />
          </div>
          <p>
            <span className="font-medium">Completed:</span>{' '}
            {worksheet.submittedAt ? formatDateTime(worksheet.submittedAt, locale) : 'Draft in progress'}
          </p>
          {worksheet.secondTechEnabled && worksheet.secondTechName && (
            <p>
              <span className="font-medium">Second Tech:</span>{' '}
              {worksheet.secondTechName} ({worksheet.secondTechStaffId ?? '—'})
            </p>
          )}
        </CardContent>
      </Card>

      <BodyFluidWorksheetForm
        worksheet={worksheet}
        editable={editable}
        saving={saving}
        onSave={handleSave}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

export default function BodyFluidDetailPage() {
  const locale = useLocale();
  const { can } = useAuth();
  const accessDenied = !canViewMedicalReports(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  return (
    <PageContentSections
      pageKey="dashboard"
      fallbackTitle="Body Fluid Worksheet"
      fallbackSubtitle="Form-Hema-010 cell count worksheet"
    >
      <BodyFluidDetailContent />
    </PageContentSections>
  );
}
