'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { MixingStudyWorksheet } from '@/components/medical-reports/mixing-study-worksheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useRouteReplace } from '@/hooks/use-route-replace';
import {
  fetchMixingStudy,
  recordMixingStudyPdfExport,
  requestMixingStudyChanges,
  reviewMixingStudy,
  saveMixingStudyDraft,
  submitMixingStudy,
} from '@/lib/clinical/mixing-studies';
import type { MixingStudyDraftInput } from '@/lib/medical-reports/form-hema-023/validation';
import { canViewMedicalReports } from '@/lib/medical-reports/permissions';
import { downloadFormHema023Pdf, printFormHema023Pdf, toFormHema023PdfModel } from '@/lib/print/form-hema-023-pdf';
import type { MixingStudy } from '@/types/mixing-study';

export default function MixingStudyDetailPage() {
  const params = useParams<{ id: string }>();
  const locale = useLocale();
  const { can } = useAuth();
  const accessDenied = !canViewMedicalReports(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [study, setStudy] = useState<MixingStudy | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [sampleLabel, setSampleLabel] = useState('Not recorded');
  const [sampleDraft, setSampleDraft] = useState('');
  const [revealedSample, setRevealedSample] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await fetchMixingStudy(params.id);
    setStudy(result.data);
    setLoading(false);
    if (result.error) toast.error(result.error);
  }, [params.id]);

  useEffect(() => {
    if (accessDenied) return;
    void reload();
  }, [accessDenied, reload]);

  useEffect(() => {
    if (!study) return;
    void fetch(`/api/medical-reports/mixing-studies/${study.id}/sample-reference`)
      .then(async (response) => {
        if (!response.ok) return;
        const body = await response.json() as { maskedLabel?: string };
        if (body.maskedLabel) setSampleLabel(body.maskedLabel);
      })
      .catch(() => undefined);
  }, [study]);

  if (accessDenied) return null;

  const run = async (action: () => Promise<{ data: MixingStudy | null; error: string | null }>, success: string) => {
    setSaving(true);
    setServerMessage(null);
    const result = await action();
    setSaving(false);
    if (result.error || !result.data) {
      setServerMessage(result.error ?? 'Unable to update mixing study');
      return;
    }
    setStudy(result.data);
    toast.success(success);
  };

  const exportPdf = async (mode: 'download' | 'print') => {
    if (!study) return;
    const error = await recordMixingStudyPdfExport(study.id);
    if (error) {
      toast.error(error);
      return;
    }
    const model = toFormHema023PdfModel(study);
    if (mode === 'download') await downloadFormHema023Pdf(model);
    else await printFormHema023Pdf(model);
  };

  const storeSample = async () => {
    if (!study) return;
    const response = await fetch(`/api/medical-reports/mixing-studies/${study.id}/sample-reference`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sampleReference: sampleDraft }),
    });
    const body = await response.json() as { maskedLabel?: string; error?: string };
    if (!response.ok) {
      toast.error(body.error ?? 'Sample reference could not be stored.');
      return;
    }
    setSampleLabel(body.maskedLabel ?? 'Not recorded');
    setSampleDraft('');
    setRevealedSample(null);
    toast.success('Sample reference updated');
  };

  const revealSample = async () => {
    if (!study) return;
    const response = await fetch(`/api/medical-reports/mixing-studies/${study.id}/sample-reference`, { method: 'POST' });
    const body = await response.json() as { sampleReference?: string; maskedLabel?: string; error?: string };
    if (!response.ok) {
      toast.error(body.error ?? 'Sample reference could not be read.');
      return;
    }
    setRevealedSample(body.sampleReference ?? body.maskedLabel ?? null);
  };

  return (
    <PageContentSections
      pageKey="dashboard"
      fallbackTitle="Coagulation Test (PT, APTT) Mixing Study"
      fallbackSubtitle="Form-Hema-023"
    >
      {loading || !study ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button variant="outline" asChild>
              <Link href={`/${locale}/medical-reports/mixing-studies`}>Back to History</Link>
            </Button>
            {study.canPrint && (
              <>
                <Button variant="outline" onClick={() => void exportPdf('download')}>Export PDF</Button>
                <Button variant="outline" onClick={() => void exportPdf('print')}>
                  <Printer className="me-2 h-4 w-4" />
                  Print
                </Button>
              </>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sample reference</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{sampleLabel}</p>
              {revealedSample && <p className="font-medium">{revealedSample}</p>}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => void revealSample()}>Show sample reference</Button>
              </div>
              {study.canEdit && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={sampleDraft}
                    autoComplete="off"
                    aria-label="Optional sample reference"
                    placeholder="Optional sample reference"
                    onChange={(event) => setSampleDraft(event.target.value)}
                  />
                  <Button type="button" variant="outline" onClick={() => void storeSample()}>Save sample reference</Button>
                </div>
              )}
              <p className="text-muted-foreground">Stored with server-side encryption. It is not printed and is masked in the history list.</p>
            </CardContent>
          </Card>

          <MixingStudyWorksheet
            key={`${study.status}|${study.submittedAt ?? ''}|${study.reviewedAt ?? ''}|${study.results.map((row) => `${row.testType}:${row.patientClottingTime}:${row.immediateRosnerIndex}:${row.conclusion}`).join('|')}`}
            study={study}
            saving={saving}
            serverMessage={serverMessage}
            onSave={(input: MixingStudyDraftInput) => void run(() => saveMixingStudyDraft(study.id, input), 'Draft saved')}
            onSubmit={(input: MixingStudyDraftInput) => void run(() => submitMixingStudy(study.id, input), 'Submitted for review')}
            onReview={(comment) => void run(() => reviewMixingStudy(study.id, comment), 'Mixing study reviewed')}
            onRequestChanges={(comment) => void run(() => requestMixingStudyChanges(study.id, comment), 'Changes requested')}
          />
        </div>
      )}
    </PageContentSections>
  );
}
