'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { CentrifugePppForm } from '@/components/ppm-calibration/centrifuge-ppp-form';
import { CentrifugePppWorkflowPanel } from '@/components/ppm-calibration/centrifuge-ppp-workflow-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useRouteReplace } from '@/hooks/use-route-replace';
import {
  approveCentrifugePppCalibration,
  fetchCentrifugePppCalibrationWithInstrument,
  getCentrifugePppSignedUrl,
  reviewCentrifugePppCalibration,
  saveCentrifugePppCalibrationDraft,
  saveCentrifugePppFinalPdf,
  submitCentrifugePppCalibration,
  submitFailedCentrifugePppForReview,
  uploadCentrifugePppEvidence,
} from '@/lib/clinical/centrifuge-ppp-calibration';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import {
  CENTRIFUGE_ASSET_CODE,
  CENTRIFUGE_NAME,
  CENTRIFUGE_SERIAL_NUMBER,
} from '@/lib/ppm-calibration/centrifuge-detection';
import {
  canEditCentrifugePppCalibration,
  getCentrifugePppDisplayStatus,
} from '@/lib/ppm-calibration/centrifuge-ppp-logic';
import type { CentrifugePppDraftFormData } from '@/lib/ppm-calibration/centrifuge-ppp-schema';
import {
  canApprovePpmCalibration,
  canCreatePpmCalibration,
  canReviewPpmCalibration,
  canViewPpmCalibration,
} from '@/lib/ppm-calibration/permissions';
import { createCentrifugePppForm009Pdf, downloadCentrifugePppForm009Pdf } from '@/lib/print/centrifuge-ppp-form-009-pdf';
import type { CentrifugePppCalibration } from '@/types/centrifuge-ppp-calibration';
import type { Instrument } from '@/types';

function CentrifugePppDetailContent() {
  const params = useParams<{ id: string }>();
  const locale = useLocale();
  const { can, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calibration, setCalibration] = useState<CentrifugePppCalibration | null>(null);
  const [instrument, setInstrument] = useState<Instrument | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await fetchCentrifugePppCalibrationWithInstrument(params.id);
    setCalibration(result.calibration);
    setInstrument(result.instrument);
    setLoading(false);
    if (result.error) toast.error(result.error);
  }, [params.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSave = async (form: CentrifugePppDraftFormData) => {
    if (!user) return;
    setSaving(true);
    const staff = await resolveStaffContext(user);
    const result = await saveCentrifugePppCalibrationDraft(params.id, staff, form);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Draft saved');
      setCalibration(result.data);
    }
    setSaving(false);
  };

  const handleUploadEvidence = async (sampleNumber: number, file: File, replacementReason?: string) => {
    if (!user) return;
    const staff = await resolveStaffContext(user);
    const result = await uploadCentrifugePppEvidence(params.id, sampleNumber, staff, file, replacementReason);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Evidence uploaded');
      setCalibration(result.data);
    }
  };

  const handleViewEvidence = async (sampleNumber: number) => {
    const sample = calibration?.samples.find((s) => s.sampleNumber === sampleNumber);
    if (!sample?.evidencePath) return;
    const url = await getCentrifugePppSignedUrl(sample.evidencePath);
    if (!url) {
      toast.error('Could not open evidence');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSubmit = async () => {
    if (!user) return;
    const staff = await resolveStaffContext(user);
    const result = await submitCentrifugePppCalibration(params.id, staff);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Calibration submitted');
      setCalibration(result.data);
    }
  };

  const handleSubmitFailedForReview = async () => {
    if (!user) return;
    const staff = await resolveStaffContext(user);
    const result = await submitFailedCentrifugePppForReview(params.id, staff);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Submitted for review');
      setCalibration(result.data);
    }
  };

  const handleReview = async (form: Parameters<typeof reviewCentrifugePppCalibration>[2]) => {
    if (!user) return;
    const staff = await resolveStaffContext(user);
    const result = await reviewCentrifugePppCalibration(params.id, staff, form);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Review recorded');
      setCalibration(result.data);
    }
  };

  const handleApprove = async (form: Parameters<typeof approveCentrifugePppCalibration>[2]) => {
    if (!user) return;
    const staff = await resolveStaffContext(user);
    const result = await approveCentrifugePppCalibration(params.id, staff, form);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Approval recorded');
      setCalibration(result.data);
      if (result.data && instrument) {
        const pdfBytes = await createCentrifugePppForm009Pdf(result.data, instrument);
        if (pdfBytes) {
          await saveCentrifugePppFinalPdf(
            params.id,
            staff,
            pdfBytes,
            `Centrifuge-PPP-Calibration-${result.data.calibrationDate}.pdf`,
          );
          await reload();
        }
      }
    }
  };

  const handleDownloadPdf = async () => {
    if (!calibration || !instrument) return;
    await downloadCentrifugePppForm009Pdf(calibration, instrument);
  };

  if (loading || !calibration) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const editable = canCreatePpmCalibration(can) && canEditCentrifugePppCalibration(calibration.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" asChild>
          <Link href={`/${locale}/ppm-calibration/centrifuge-ppp`}>Back to History</Link>
        </Button>
        <Button variant="outline" onClick={() => void handleDownloadPdf()}>
          <Download className="h-4 w-4 me-2" />Download Form-Hema-009 PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Centrifuge Calibration for PPP
            <Badge>{getCentrifugePppDisplayStatus(calibration)}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3 text-sm">
          <p><span className="font-medium">Instrument:</span> {instrument?.name ?? CENTRIFUGE_NAME}</p>
          <p><span className="font-medium">Serial Number:</span> {instrument?.serialNumber ?? CENTRIFUGE_SERIAL_NUMBER}</p>
          <p><span className="font-medium">Asset Code:</span> {instrument?.assetCode ?? CENTRIFUGE_ASSET_CODE}</p>
          <p><span className="font-medium">Performed By:</span> {calibration.performedByName} ({calibration.performedByStaffId ?? '—'})</p>
        </CardContent>
      </Card>

      <CentrifugePppForm
        calibration={calibration}
        editable={editable}
        saving={saving}
        onSave={handleSave}
        onUploadEvidence={handleUploadEvidence}
        onViewEvidence={handleViewEvidence}
      />

      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void handleSubmit()}>Submit Calibration</Button>
          {calibration.status === 'failed' && (
            <Button variant="secondary" onClick={() => void handleSubmitFailedForReview()}>
              Submit Failed Calibration for Review
            </Button>
          )}
        </div>
      )}

      <CentrifugePppWorkflowPanel
        calibration={calibration}
        canReview={canReviewPpmCalibration(can)}
        canApprove={canApprovePpmCalibration(can)}
        onReview={handleReview}
        onApprove={handleApprove}
      />
    </div>
  );
}

export default function CentrifugePppDetailPage() {
  const locale = useLocale();
  const { can } = useAuth();
  const accessDenied = !canViewPpmCalibration(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  return (
    <PageContentSections
      pageKey="ppm_calibration"
      fallbackTitle="Centrifuge PPP Calibration"
      fallbackSubtitle="Form-Hema-009 verification record"
    >
      <CentrifugePppDetailContent />
    </PageContentSections>
  );
}
