'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Trash2, Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog } from '@/lib/page-utils';
import { downloadCSV, generateId } from '@/lib/utils';
import type { DynamicForm, FormField, FormFieldType } from '@/types/modules';

const FIELD_TYPES: FormFieldType[] = ['text', 'number', 'date', 'time', 'dropdown', 'radio', 'checkbox', 'file', 'signature', 'email', 'phone', 'multiselect'];

export default function FormBuilderPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('forms.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [selectedId, setSelectedId] = useState<string | null>(db.dynamicForms[0]?.id ?? null);
  const [newField, setNewField] = useState<Partial<FormField>>({ type: 'text', required: false });
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  if (!can('forms.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const form = db.dynamicForms.find((f) => f.id === selectedId);
  const responses = db.formResponses.filter((r) => r.formId === selectedId);

  const saveForm = (updated: DynamicForm) => {
    const idx = db.dynamicForms.findIndex((f) => f.id === updated.id);
    if (idx >= 0) {
      db.dynamicForms[idx] = updated;
      if (user) appendAuditLog(db, user.id, 'update', 'forms', updated.id);
      saveMockDatabase(db);
      refresh();
    }
  };

  const createForm = () => {
    if (!canManage || !user) return;
    const f: DynamicForm = {
      id: generateId(),
      title: 'New Form',
      fields: [],
      isPublished: false,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.dynamicForms.push(f);
    appendAuditLog(db, user.id, 'create', 'forms', f.id);
    saveMockDatabase(db);
    setSelectedId(f.id);
    refresh();
    toast.success('Form created');
  };

  const addField = () => {
    if (!form || !newField.label || !canManage) return;
    const field: FormField = {
      id: generateId(),
      label: newField.label,
      type: newField.type ?? 'text',
      required: newField.required ?? false,
      options: ['dropdown', 'radio', 'multiselect'].includes(newField.type ?? '') ? (newField.options ?? ['Option 1']) : undefined,
    };
    saveForm({ ...form, fields: [...form.fields, field], updatedAt: new Date().toISOString() });
    setNewField({ type: 'text', required: false });
    toast.success('Field added');
  };

  const exportExcel = () => {
    if (!form) return;
    const headers = ['Submitted At', ...form.fields.map((f) => f.label)];
    const rows = responses.map((r) => [
      r.submittedAt,
      ...form.fields.map((f) => String(r.answers[f.id] ?? '')),
    ]);
    downloadCSV(`${form.title.replace(/\s+/g, '-').toLowerCase()}-responses.csv`, headers, rows);
    toast.success('Exported to Excel (CSV)');
  };

  const exportPDF = () => {
    if (!form) return;
    const content = `Form: ${form.title}\nResponses: ${responses.length}\n\n${responses.map((r) => JSON.stringify(r.answers, null, 2)).join('\n\n')}`;
    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${form.title.replace(/\s+/g, '-').toLowerCase()}-responses.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('PDF exported (demo)');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Form Builder</h1>
          <p className="text-muted-foreground">Create dynamic forms without coding</p>
        </div>
        {canManage && <Button onClick={createForm}><Plus className="h-4 w-4 me-2" />New Form</Button>}
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Forms</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {db.dynamicForms.map((f) => (
              <button key={f.id} onClick={() => setSelectedId(f.id)} className={`w-full text-start rounded-lg px-3 py-2 text-sm ${selectedId === f.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}>
                {f.title}
                {f.isPublished && <Badge className="ms-2" variant="success">Live</Badge>}
              </button>
            ))}
          </CardContent>
        </Card>

        {form && (
          <div className="lg:col-span-3 space-y-4">
            <Tabs defaultValue="builder">
              <TabsList>
                <TabsTrigger value="builder">Builder</TabsTrigger>
                <TabsTrigger value="responses">Responses ({responses.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="builder" className="space-y-4 mt-4">
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                      <Label>Form Title</Label>
                      <Input value={form.title} disabled={!canManage} onChange={(e) => saveForm({ ...form, title: e.target.value, updatedAt: new Date().toISOString() })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea value={form.description ?? ''} disabled={!canManage} onChange={(e) => saveForm({ ...form, description: e.target.value, updatedAt: new Date().toISOString() })} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={form.isPublished} disabled={!canManage} onCheckedChange={(v) => saveForm({ ...form, isPublished: v, updatedAt: new Date().toISOString() })} />
                      <Label>Published</Label>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Fields</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {form.fields.map((field) => (
                      <div key={field.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div>
                          <p className="font-medium text-sm">{field.label}</p>
                          <p className="text-xs text-muted-foreground capitalize">{field.type}{field.required ? ' · Required' : ''}</p>
                        </div>
                        {canManage && (
                          <Button size="sm" variant="ghost" onClick={() => saveForm({ ...form, fields: form.fields.filter((f) => f.id !== field.id), updatedAt: new Date().toISOString() })}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}

                    {canManage && (
                      <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
                        <p className="text-sm font-medium">Add Field</p>
                        <div className="grid sm:grid-cols-3 gap-3">
                          <Input placeholder="Label" value={newField.label ?? ''} onChange={(e) => setNewField({ ...newField, label: e.target.value })} />
                          <Select value={newField.type} onValueChange={(v) => setNewField({ ...newField, type: v as FormFieldType })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                          </Select>
                          <Button onClick={addField}><Plus className="h-4 w-4 me-1" />Add</Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="responses" className="mt-4 space-y-4">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4 me-1" />Export Excel</Button>
                  <Button variant="outline" size="sm" onClick={exportPDF}><Download className="h-4 w-4 me-1" />Export PDF</Button>
                </div>
                {responses.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground mb-2">{new Date(r.submittedAt).toLocaleString()}</p>
                      <div className="grid sm:grid-cols-2 gap-2 text-sm">
                        {form.fields.map((f) => (
                          <div key={f.id}><span className="font-medium">{f.label}:</span> {String(r.answers[f.id] ?? '—')}</div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {responses.length === 0 && <p className="text-muted-foreground text-center py-8">{tc('noData')}</p>}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
