'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { ArrowLeft, Eye, Loader2, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/components/providers/auth-provider';
import { FieldPropertiesPanel } from '@/components/fillable-pdf/field-properties-panel';
import { FieldToolbox, createEmptyPdfField } from '@/components/fillable-pdf/field-toolbox';
import { PdfPageViewer } from '@/components/fillable-pdf/pdf-page-viewer';
import { clampNormalizedRect } from '@/lib/fillable-pdf/coordinates';
import {
  fetchFillablePdfTemplateById,
  publishFillablePdfTemplate,
  resolveTemplatePdfUrl,
  toTemplateInput,
  updateFillablePdfTemplate,
} from '@/lib/fillable-pdf/templates';
import { canAccessFillableFormDesigner, canPublishForms } from '@/lib/forms/permissions';
import type { FillablePdfField, FillablePdfFieldType, FillablePdfTemplate } from '@/types/modules';

export default function FillableFormDesignPage() {
  const params = useParams<{ templateId: string }>();
  const locale = useLocale();
  const { can, user } = useAuth();
  const canDesign = canAccessFillableFormDesigner(can);
  const canPublish = canPublishForms(can);

  const accessDenied = !canDesign;
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const [template, setTemplate] = useState<FillablePdfTemplate | null>(null);
  const [fields, setFields] = useState<FillablePdfField[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [scale, setScale] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchFillablePdfTemplateById(params.templateId);
    setTemplate(result.data);
    setFields(result.data?.fields ?? []);
    setError(result.error ?? (result.data ? null : 'Template not found'));
    setLoading(false);
  }, [params.templateId]);

  useEffect(() => {
    if (!accessDenied) void load();
  }, [accessDenied, load]);

  const selectedField = useMemo(
    () => fields.find((f) => f.id === selectedId) ?? null,
    [fields, selectedId],
  );

  if (accessDenied) return null;

  const persist = async (nextFields: FillablePdfField[], message = 'Draft saved') => {
    if (!template || !user) return;
    setSaving(true);
    const input = toTemplateInput({ ...template, status: 'draft', isPublished: false, fields: nextFields });
    const result = await updateFillablePdfTemplate(template.id, user.id, input);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to save');
      return;
    }
    setTemplate(result.data);
    setFields(result.data.fields);
    toast.success(message);
  };

  const addField = (type: FillablePdfFieldType, label = 'New Field') => {
    const field = createEmptyPdfField(type, label, 1, 0.1, 0.1);
    const next = [...fields, field];
    setFields(next);
    setSelectedId(field.id);
  };

  const handleCanvasClick = (_page: number, x: number, y: number) => {
    const field = createEmptyPdfField('text', 'New Field', 1, x, y);
    const next = [...fields, field];
    setFields(next);
    setSelectedId(field.id);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (error || !template) {
    return <EmptyState title="Template unavailable" description={error ?? 'Unable to load template.'} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" className="px-0 mb-2">
            <Link href={`/${locale}/fillable-forms`}><ArrowLeft className="h-4 w-4 me-2" />Back to Fillable Forms</Link>
          </Button>
          <h1 className="text-2xl font-bold">{template.title}</h1>
          <p className="text-muted-foreground">{template.formNumber} · Designer</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={saving} onClick={() => void persist(fields)}>
            <Save className="h-4 w-4 me-2" />Save Draft
          </Button>
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4 me-2" />Preview
          </Button>
          {canPublish && (
            <Button disabled={saving} onClick={async () => {
              await persist(fields, 'Draft saved');
              if (!user) return;
              setSaving(true);
              const result = await publishFillablePdfTemplate({ ...template, fields }, user.id);
              setSaving(false);
              if (result.error) toast.error(result.error);
              else {
                toast.success('Template published');
                void load();
              }
            }}>
              <Send className="h-4 w-4 me-2" />Publish
            </Button>
          )}
        </div>
      </div>

      <div className="grid xl:grid-cols-12 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle className="text-sm">Field Toolbox</CardTitle></CardHeader>
          <CardContent><FieldToolbox onAddField={addField} /></CardContent>
        </Card>

        <div className="xl:col-span-7 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Zoom</span>
            {[0.75, 1, 1.25].map((s) => (
              <Button key={s} size="sm" variant={scale === s ? 'default' : 'outline'} onClick={() => setScale(s)}>{Math.round(s * 100)}%</Button>
            ))}
          </div>
          <PdfPageViewer
            pdfUrl={resolveTemplatePdfUrl(template.id)}
            scale={scale}
            fields={fields}
            mode="design"
            values={previewValues}
            selectedFieldId={selectedId}
            onSelectField={setSelectedId}
            onCanvasClick={handleCanvasClick}
            onFieldMove={(fieldId, patch) => {
              setFields((prev) => prev.map((f) => {
                if (f.id !== fieldId) return f;
                return { ...f, ...clampNormalizedRect({ ...f, ...patch }) };
              }));
            }}
          />
        </div>

        <Card className="xl:col-span-3 h-fit">
          <CardHeader><CardTitle className="text-sm">Properties</CardTitle></CardHeader>
          <CardContent>
            <FieldPropertiesPanel
              field={selectedField}
              onChange={(field) => setFields((prev) => prev.map((f) => f.id === field.id ? field : f))}
              onDelete={(fieldId) => {
                setFields((prev) => prev.filter((f) => f.id !== fieldId));
                setSelectedId(null);
              }}
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Template Preview</DialogTitle></DialogHeader>
          <PdfPageViewer
            pdfUrl={resolveTemplatePdfUrl(template.id)}
            fields={fields}
            mode="preview"
            values={previewValues}
            onFieldChange={(key, value) => setPreviewValues((prev) => ({ ...prev, [key]: value }))}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
