'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { ArrowLeft, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/providers/auth-provider';
import { createFillablePdfTemplateFromUpload, uploadTemplatePdf } from '@/lib/fillable-pdf/templates';
import { readPdfHeader, readPdfPageMetrics } from '@/lib/fillable-pdf/pdf-upload';
import { buildTemplateSourcePath } from '@/lib/fillable-pdf/storage-paths';
import { canAccessFillableFormDesigner } from '@/lib/forms/permissions';

const CATEGORIES = [
  'Quality',
  'Operations',
  'Education',
  'Safety',
  'Administrative',
  'Other',
];

export default function NewFillableFormPage() {
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canDesign = canAccessFillableFormDesigner(can);
  const accessDenied = !canDesign;
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const [title, setTitle] = useState('');
  const [formNumber, setFormNumber] = useState('');
  const [version, setVersion] = useState('1');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  if (accessDenied) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || !formNumber.trim() || !category.trim()) {
      toast.error('Form name, form number, and category are required.');
      return;
    }
    if (!pdfFile) {
      toast.error('Upload a PDF template.');
      return;
    }

    const headerCheck = await readPdfHeader(pdfFile);
    if (!headerCheck.valid) {
      toast.error(headerCheck.error ?? 'Invalid PDF.');
      return;
    }

    setSaving(true);
    try {
      const metrics = await readPdfPageMetrics(pdfFile);
      const templateId = crypto.randomUUID();
      const versionNum = Math.max(1, Number.parseInt(version, 10) || 1);
      const storagePath = buildTemplateSourcePath(templateId, versionNum);

      const upload = await uploadTemplatePdf(templateId, pdfFile, versionNum);
      if (upload.error || !upload.path) {
        toast.error(upload.error ?? 'PDF upload failed.');
        setSaving(false);
        return;
      }

      const result = await createFillablePdfTemplateFromUpload(user.id, {
        id: templateId,
        title: title.trim(),
        formNumber: formNumber.trim(),
        category: category.trim(),
        description: description.trim() || undefined,
        effectiveDate: effectiveDate || undefined,
        reviewDate: reviewDate || undefined,
        version: versionNum,
        sourcePdfPath: storagePath,
        sourcePdfName: pdfFile.name,
        pageCount: metrics.pageCount,
        pageWidthPt: metrics.pageWidthPt,
        pageHeightPt: metrics.pageHeightPt,
      });

      if (result.error || !result.data) {
        toast.error(result.error ?? 'Failed to create form.');
        setSaving(false);
        return;
      }

      toast.success('Draft saved — opening designer.');
      router.push(`/${locale}/fillable-forms/design/${result.data.id}`);
    } catch {
      toast.error('Failed to process PDF.');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Button asChild variant="ghost" className="px-0 mb-2">
          <Link href={`/${locale}/fillable-forms`}><ArrowLeft className="h-4 w-4 me-2" />Back to Fillable Forms</Link>
        </Button>
        <h1 className="text-2xl font-bold">Upload PDF Form</h1>
        <p className="text-muted-foreground">Create a new fillable PDF form from an uploaded template. Status starts as Draft.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Form Details</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
            <div><Label htmlFor="title">Form Name *</Label><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="formNumber">Form Number *</Label><Input id="formNumber" value={formNumber} onChange={(e) => setFormNumber(e.target.value)} placeholder="Form-Hema-002" required /></div>
              <div><Label htmlFor="version">Version *</Label><Input id="version" type="number" min={1} value={version} onChange={(e) => setVersion(e.target.value)} required /></div>
            </div>
            <div>
              <Label htmlFor="category">Category *</Label>
              <Input id="category" list="fillable-categories" value={category} onChange={(e) => setCategory(e.target.value)} required />
              <datalist id="fillable-categories">
                {CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div><Label htmlFor="description">Description</Label><Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="effectiveDate">Effective Date</Label><Input id="effectiveDate" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} /></div>
              <div><Label htmlFor="reviewDate">Review Date</Label><Input id="reviewDate" type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} /></div>
            </div>
            <div>
              <Label htmlFor="pdf">PDF Template *</Label>
              <Input id="pdf" type="file" accept=".pdf,application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} required />
              <p className="text-xs text-muted-foreground mt-1">PDF only, max 20 MB. Stored in private storage.</p>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Upload className="h-4 w-4 me-2" />}
              Save Draft &amp; Open Designer
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
