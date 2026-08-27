'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/components/providers/auth-provider';
import { FormRenderer, validateFormAnswers } from '@/components/form-builder/form-renderer';
import { fetchDynamicFormById, submitFormResponse } from '@/lib/clinical/forms';
import { normalizeStaffId } from '@/lib/staff/identity';
import type { DynamicForm } from '@/types/modules';

export default function FillFormPage() {
  const params = useParams<{ formId: string }>();
  const router = useRouter();
  const locale = useLocale();
  const { can, user } = useAuth();
  const [form, setForm] = useState<DynamicForm | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accessDenied = !can('forms.view');
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  useEffect(() => {
    void fetchDynamicFormById(params.formId).then((result) => {
      setForm(result.data);
      setError(result.error ?? (result.data?.status !== 'published' ? 'This form is not published.' : null));
      setLoading(false);
    });
  }, [params.formId]);

  if (accessDenied) return null;

  const handleSubmit = async () => {
    if (!form || !user) return;
    const validationError = validateFormAnswers(form.fields, values);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSubmitting(true);
    const result = await submitFormResponse(
      form,
      user.id,
      user.fullName,
      normalizeStaffId(user.staffId),
      values,
    );
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Form submitted successfully');
    router.push(`/${locale}/form-builder`);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (error || !form) {
    return <EmptyState title="Form unavailable" description={error ?? 'Unable to load form.'} />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button asChild variant="ghost" className="px-0">
        <Link href={`/${locale}/form-builder`}><ArrowLeft className="h-4 w-4 me-2" />Back to Form Builder</Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{form.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {form.formNumber ? `Form ${form.formNumber}` : 'Electronic Form'} · v{form.version}
          </p>
          {form.description && <p className="text-sm text-muted-foreground mt-2">{form.description}</p>}
        </CardHeader>
        <CardContent className="space-y-6">
          <FormRenderer
            fields={form.fields}
            values={values}
            onChange={(fieldId, value) => setValues((prev) => ({ ...prev, [fieldId]: value }))}
          />
          <Button className="w-full sm:w-auto" disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Send className="h-4 w-4 me-2" />}
            Submit Form
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
