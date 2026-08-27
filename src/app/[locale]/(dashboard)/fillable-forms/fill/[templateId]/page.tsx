'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { ArrowLeft, Download, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/components/providers/auth-provider';
import { PdfPageViewer } from '@/components/fillable-pdf/pdf-page-viewer';
import { buildInitialFillValues } from '@/lib/fillable-pdf/field-values';
import { downloadCompletedPdf, generateCompletedFillablePdf } from '@/lib/fillable-pdf/generate-completed-pdf';
import { fetchPdfArrayBuffer } from '@/lib/fillable-pdf/pdf-client';
import { submitFillablePdfForm } from '@/lib/fillable-pdf/submissions';
import {
  fetchFillablePdfTemplateById,
  resolveTemplatePdfUrl,
} from '@/lib/fillable-pdf/templates';
import { canSubmitForms, canViewPublishedForms } from '@/lib/forms/permissions';
import { normalizeStaffId } from '@/lib/staff/identity';
import type { FillablePdfTemplate } from '@/types/modules';

export default function FillableFormFillPage() {
  const params = useParams<{ templateId: string }>();
  const searchParams = useSearchParams();
  const isPreview = searchParams.get('preview') === '1';
  const locale = useLocale();
  const { can, user } = useAuth();
  const canView = canViewPublishedForms(can);
  const canFill = canSubmitForms(can);

  const accessDenied = !canView;
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const [template, setTemplate] = useState<FillablePdfTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchFillablePdfTemplateById(params.templateId);
    if (!result.data) {
      setError(result.error ?? 'Template not found');
      setLoading(false);
      return;
    }
    if (!isPreview && result.data.status !== 'published' && !result.data.isPublished) {
      setError('This template is not published.');
      setTemplate(result.data);
      setLoading(false);
      return;
    }
    setTemplate(result.data);
    if (user) {
      setValues(buildInitialFillValues(result.data.fields, {
        fullName: user.fullName,
        staffId: normalizeStaffId(user.staffId),
      }));
    }
    setError(null);
    setLoading(false);
  }, [params.templateId, isPreview, user]);

  useEffect(() => {
    if (!accessDenied) void load();
  }, [accessDenied, load]);

  if (accessDenied) return null;

  const handleSubmit = async () => {
    if (!template || !user || !canFill || isPreview) return;
    setSubmitting(true);
    try {
      const buffer = await fetchPdfArrayBuffer(resolveTemplatePdfUrl(template.id));
      const pdfBytes = new Uint8Array(buffer);
      const result = await submitFillablePdfForm(
        template,
        pdfBytes,
        user.id,
        user.fullName,
        normalizeStaffId(user.staffId),
        values,
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Form submitted');
        if (result.completedPdfBytes) {
          await downloadCompletedPdf(
            `${template.formNumber ?? template.title}-completed.pdf`,
            result.completedPdfBytes,
          );
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPreview = async () => {
    if (!template) return;
    try {
      const buffer = await fetchPdfArrayBuffer(resolveTemplatePdfUrl(template.id));
      const bytes = await generateCompletedFillablePdf(new Uint8Array(buffer), template, values);
      await downloadCompletedPdf(`${template.formNumber ?? template.title}-preview.pdf`, bytes);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate PDF');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (error || !template) {
    return <EmptyState title="Form unavailable" description={error ?? 'Unable to load form.'} />;
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <Button asChild variant="ghost" className="px-0">
        <Link href={`/${locale}/fillable-forms`}><ArrowLeft className="h-4 w-4 me-2" />Back to Fillable Forms</Link>
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{template.title}</h1>
          <p className="text-sm text-muted-foreground">{template.formNumber} · v{template.version}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[0.75, 1, 1.25].map((s) => (
            <Button key={s} size="sm" variant={scale === s ? 'default' : 'outline'} onClick={() => setScale(s)}>{Math.round(s * 100)}%</Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => void handleDownloadPreview()}>
            <Download className="h-4 w-4 me-1" />Download PDF
          </Button>
          {!isPreview && canFill && (
            <Button size="sm" disabled={submitting} onClick={() => void handleSubmit()}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Send className="h-4 w-4 me-1" />}
              Submit
            </Button>
          )}
        </div>
      </div>

      <PdfPageViewer
        pdfUrl={resolveTemplatePdfUrl(template.id)}
        scale={scale}
        fields={template.fields}
        mode={isPreview ? 'preview' : 'fill'}
        values={values}
        onFieldChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
      />
    </div>
  );
}
