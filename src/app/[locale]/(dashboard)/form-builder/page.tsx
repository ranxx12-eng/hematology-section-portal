'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowDown, ArrowUp, Copy, Download, Eye, FileSpreadsheet, GripVertical, Loader2, Pencil, Plus, Printer, Save, Send, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/components/providers/auth-provider';
import { FormLibraryPanel } from '@/components/form-builder/form-library-panel';
import { FormFieldEditorDialog, createEmptyField } from '@/components/form-builder/form-field-editor-dialog';
import { ImportFormDialog } from '@/components/form-builder/import-form-dialog';
import { FormRenderer, formatAnswerValue, getResponseFields, validateFormAnswers } from '@/components/form-builder/form-renderer';
import {
  archiveDynamicForm,
  createDynamicForm,
  duplicateDynamicForm,
  fetchDynamicForms,
  fetchFormResponses,
  publishDynamicForm,
  updateDynamicForm,
} from '@/lib/clinical/forms';
import { downloadFormResponsePdf } from '@/lib/print/form-response-report';
import { FORM_CATEGORIES, FORM_FIELD_TYPE_LABELS, type DynamicFormInput } from '@/lib/forms/schema';
import { downloadCSV } from '@/lib/utils';
import type { DynamicForm, FormField, FormResponse } from '@/types/modules';

function toInput(form: DynamicForm): DynamicFormInput {
  return {
    title: form.title,
    formNumber: form.formNumber,
    description: form.description,
    category: form.category,
    version: form.version,
    status: form.status,
    isPublished: form.isPublished,
    effectiveDate: form.effectiveDate,
    reviewDate: form.reviewDate,
    fields: form.fields,
  };
}

export default function FormBuilderPage() {
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('forms.manage');

  const [forms, setForms] = useState<DynamicForm[]>([]);
  const [draftForm, setDraftForm] = useState<DynamicForm | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});
  const [fieldEditorOpen, setFieldEditorOpen] = useState(false);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [responseView, setResponseView] = useState<FormResponse | null>(null);
  const [responseFilter, setResponseFilter] = useState('');
  const [activeTab, setActiveTab] = useState('builder');

  const loadForms = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchDynamicForms();
    setForms(result.data);
    setError(result.error);
    if (!selectedId && result.data[0]) {
      setSelectedId(result.data[0].id);
      setDraftForm(structuredClone(result.data[0]));
    }
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    void loadForms();
  }, [loadForms]);

  useEffect(() => {
    const selected = forms.find((f) => f.id === selectedId) ?? null;
    setDraftForm(selected ? structuredClone(selected) : null);
  }, [selectedId, forms]);

  useEffect(() => {
    if (!selectedId) {
      setResponses([]);
      return;
    }
    void fetchFormResponses(selectedId).then((result) => setResponses(result.data));
  }, [selectedId, forms]);

  const accessDenied = !can('forms.view');
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  const persistDraft = async (next: DynamicForm, message = 'Draft saved') => {
    if (!user || !canManage) return;
    setSaving(true);
    const input = toInput({ ...next, status: 'draft', isPublished: false });
    const result = await updateDynamicForm(next.id, user.id, input);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to save form');
      return;
    }
    setDraftForm(structuredClone(result.data));
    toast.success(message);
    void loadForms();
  };

  const createForm = async () => {
    if (!canManage || !user) return;
    setSaving(true);
    const result = await createDynamicForm(user.id, {
      title: 'New Form',
      formNumber: '',
      description: '',
      category: 'General',
      version: 1,
      status: 'draft',
      isPublished: false,
      fields: [],
    });
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to create form');
      return;
    }
    setSelectedId(result.data.id);
    toast.success('Form created');
    void loadForms();
  };

  const handlePublish = async () => {
    if (!draftForm || !user) return;
    await persistDraft(draftForm, 'Draft saved');
    setSaving(true);
    const result = await publishDynamicForm(draftForm, user.id);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to publish form');
      return;
    }
    toast.success('Form published');
    void loadForms();
  };

  const handleArchive = async (form: DynamicForm) => {
    if (!user) return;
    setSaving(true);
    const result = await archiveDynamicForm(form, user.id);
    setSaving(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Form archived');
      void loadForms();
    }
  };

  const handleDuplicate = async (form: DynamicForm) => {
    if (!user) return;
    setSaving(true);
    const result = await duplicateDynamicForm(form, user.id);
    setSaving(false);
    if (result.error || !result.data) toast.error(result.error ?? 'Failed to duplicate');
    else {
      setSelectedId(result.data.id);
      toast.success('Form duplicated');
      void loadForms();
    }
  };

  const moveField = (index: number, direction: -1 | 1) => {
    if (!draftForm) return;
    const target = index + direction;
    if (target < 0 || target >= draftForm.fields.length) return;
    const fields = [...draftForm.fields];
    [fields[index], fields[target]] = [fields[target], fields[index]];
    setDraftForm({ ...draftForm, fields });
  };

  const saveField = (field: FormField) => {
    if (!draftForm) return;
    const exists = draftForm.fields.some((f) => f.id === field.id);
    const fields = exists
      ? draftForm.fields.map((f) => (f.id === field.id ? field : f))
      : [...draftForm.fields, field];
    setDraftForm({ ...draftForm, fields });
  };

  const filteredResponses = useMemo(() => {
    const q = responseFilter.trim().toLowerCase();
    if (!q) return responses;
    return responses.filter((response) =>
      (response.submittedByName ?? '').toLowerCase().includes(q)
      || (response.submittedByStaffId ?? '').toLowerCase().includes(q)
      || response.id.toLowerCase().includes(q),
    );
  }, [responses, responseFilter]);

  const exportCsv = () => {
    if (!draftForm) return;
    const headers = ['Submission ID', 'Submitted At', 'Submitted By', 'Staff ID', ...draftForm.fields.map((f) => f.label)];
    const rows = filteredResponses.map((response) => [
      response.id,
      response.submittedAt,
      response.submittedByName ?? '',
      response.submittedByStaffId ?? '',
      ...draftForm.fields.map((field) => formatAnswerValue(response.answers[field.id])),
    ]);
    downloadCSV(`${draftForm.title.replace(/\s+/g, '-').toLowerCase()}-responses.csv`, headers, rows);
    toast.success('Exported CSV');
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Form Builder</h1>
          <p className="text-muted-foreground">Design, publish, and manage electronic laboratory forms</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Button onClick={createForm} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Plus className="h-4 w-4 me-2" />}
              New Form
            </Button>
          )}
          {draftForm?.status === 'published' && (
            <Button asChild variant="outline">
              <Link href={`/${locale}/form-builder/fill/${draftForm.id}`}>
                <Send className="h-4 w-4 me-2" />Complete Form
              </Link>
            </Button>
          )}
        </div>
      </div>

      {error && <EmptyState title="Failed to load forms" description={error} />}

      <div className="grid xl:grid-cols-12 gap-6">
        <Card className="xl:col-span-3">
          <CardHeader><CardTitle className="text-base">Form Library</CardTitle></CardHeader>
          <CardContent>
            <FormLibraryPanel
              forms={forms}
              selectedId={selectedId}
              search={search}
              canManage={canManage}
              onSearchChange={setSearch}
              onSelect={setSelectedId}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
              onPreview={(form) => { setDraftForm(structuredClone(form)); setPreviewOpen(true); }}
              onImport={() => setImportOpen(true)}
            />
          </CardContent>
        </Card>

        {draftForm && (
          <>
            <div className="xl:col-span-6 space-y-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="builder">Builder</TabsTrigger>
                  <TabsTrigger value="responses">Responses ({responses.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="builder" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-base">Fields</CardTitle>
                      {canManage && (
                        <Button size="sm" onClick={() => { setEditingField(createEmptyField()); setFieldEditorOpen(true); }}>
                          <Plus className="h-4 w-4 me-1" />Add Field
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {draftForm.fields.map((field, index) => (
                        <div key={field.id} className="rounded-lg border border-border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2">
                              <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="font-medium text-sm">{field.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {FORM_FIELD_TYPE_LABELS[field.type]}
                                  {field.required ? ' · Required' : ''}
                                </p>
                              </div>
                            </div>
                            {canManage && (
                              <div className="flex flex-wrap gap-1">
                                <Button size="icon" variant="ghost" onClick={() => moveField(index, -1)} disabled={index === 0}><ArrowUp className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => moveField(index, 1)} disabled={index === draftForm.fields.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => { setEditingField(field); setFieldEditorOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => saveField({ ...field, id: crypto.randomUUID(), label: `${field.label} (Copy)` })}><Copy className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => setDraftForm({ ...draftForm, fields: draftForm.fields.filter((f) => f.id !== field.id) })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {draftForm.fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No fields yet. Add your first field.</p>}
                    </CardContent>
                  </Card>

                  <div className="flex flex-wrap gap-2">
                    {canManage && (
                      <>
                        <Button variant="outline" onClick={() => void persistDraft(draftForm)} disabled={saving}>
                          <Save className="h-4 w-4 me-2" />Save Draft
                        </Button>
                        <Button onClick={() => void handlePublish()} disabled={saving}>
                          <Send className="h-4 w-4 me-2" />Publish
                        </Button>
                      </>
                    )}
                    <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                      <Eye className="h-4 w-4 me-2" />Preview
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="responses" className="mt-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Input placeholder="Search submitter or staff ID..." value={responseFilter} onChange={(e) => setResponseFilter(e.target.value)} className="max-w-xs" />
                    <Button variant="outline" size="sm" onClick={exportCsv}><FileSpreadsheet className="h-4 w-4 me-1" />Export CSV</Button>
                  </div>
                  {filteredResponses.map((response) => (
                    <Card key={response.id}>
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm">{response.submittedByName ?? 'Unknown submitter'}</p>
                            <p className="text-xs text-muted-foreground">
                              Staff ID: {response.submittedByStaffId ?? 'Not assigned'} · {new Date(response.submittedAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setResponseView(response)}>View</Button>
                            <Button size="sm" variant="outline" onClick={() => void downloadFormResponsePdf(draftForm, response)}>
                              <Printer className="h-4 w-4 me-1" />PDF
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredResponses.length === 0 && <p className="text-muted-foreground text-center py-8">No responses yet.</p>}
                </TabsContent>
              </Tabs>
            </div>

            <Card className="xl:col-span-3 h-fit">
              <CardHeader><CardTitle className="text-base">Form Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Form Title</Label><Input value={draftForm.title} disabled={!canManage} onChange={(e) => setDraftForm({ ...draftForm, title: e.target.value })} /></div>
                <div><Label>Form Number</Label><Input value={draftForm.formNumber ?? ''} disabled={!canManage} onChange={(e) => setDraftForm({ ...draftForm, formNumber: e.target.value })} /></div>
                <div><Label>Category</Label>
                  <Select value={draftForm.category ?? 'General'} disabled={!canManage} onValueChange={(category) => setDraftForm({ ...draftForm, category })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FORM_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Description</Label><Textarea value={draftForm.description ?? ''} disabled={!canManage} onChange={(e) => setDraftForm({ ...draftForm, description: e.target.value })} rows={3} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Version</Label><Input value={`v${draftForm.version}`} readOnly disabled /></div>
                  <div><Label>Status</Label><Badge className="mt-2 capitalize">{draftForm.status}</Badge></div>
                </div>
                <div><Label>Effective Date</Label><Input type="date" value={draftForm.effectiveDate ?? ''} disabled={!canManage} onChange={(e) => setDraftForm({ ...draftForm, effectiveDate: e.target.value })} /></div>
                <div><Label>Review Date</Label><Input type="date" value={draftForm.reviewDate ?? ''} disabled={!canManage} onChange={(e) => setDraftForm({ ...draftForm, reviewDate: e.target.value })} /></div>
                <p className="text-xs text-muted-foreground">Owner: {draftForm.ownerName ?? draftForm.createdByName ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Updated: {new Date(draftForm.updatedAt).toLocaleString()}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Form Preview</DialogTitle></DialogHeader>
          {draftForm && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{draftForm.title}</h2>
                {draftForm.formNumber && <p className="text-sm text-muted-foreground">Form {draftForm.formNumber} · v{draftForm.version}</p>}
              </div>
              <FormRenderer
                fields={draftForm.fields}
                values={previewValues}
                preview
                onChange={(fieldId, value) => setPreviewValues((prev) => ({ ...prev, [fieldId]: value }))}
              />
              <p className="text-xs text-muted-foreground">Preview mode — submissions are disabled.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!responseView} onOpenChange={(open) => !open && setResponseView(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Submitted Response</DialogTitle></DialogHeader>
          {responseView && draftForm && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p><strong>Submitted By:</strong> {responseView.submittedByName ?? '—'}</p>
                <p><strong>Staff ID:</strong> {responseView.submittedByStaffId ?? 'Not assigned'}</p>
                <p><strong>Date/Time:</strong> {new Date(responseView.submittedAt).toLocaleString()}</p>
                <p><strong>Version:</strong> v{responseView.formVersion ?? draftForm.version}</p>
              </div>
              {getResponseFields(responseView, draftForm).map((field) => (
                <div key={field.id}>
                  <p className="font-medium text-sm">{field.label}</p>
                  <p className="text-sm text-muted-foreground">{formatAnswerValue(responseView.answers[field.id])}</p>
                </div>
              ))}
              <Button onClick={() => void downloadFormResponsePdf(draftForm, responseView)}>
                <Download className="h-4 w-4 me-2" />Download PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <FormFieldEditorDialog
        open={fieldEditorOpen}
        field={editingField}
        onOpenChange={setFieldEditorOpen}
        onSave={(field) => {
          saveField(field);
          toast.success('Field updated — save draft to persist');
        }}
      />
      <ImportFormDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
