'use client';

import { Archive, Copy, Eye, Pencil, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DynamicForm, FormStatus } from '@/types/modules';

const STATUS_VARIANT: Record<FormStatus, 'default' | 'secondary' | 'outline'> = {
  draft: 'secondary',
  published: 'default',
  archived: 'outline',
};

interface FormLibraryPanelProps {
  forms: DynamicForm[];
  selectedId: string | null;
  search: string;
  canManage: boolean;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  onDuplicate: (form: DynamicForm) => void;
  onArchive: (form: DynamicForm) => void;
  onPreview: (form: DynamicForm) => void;
  onImport: () => void;
}

export function FormLibraryPanel({
  forms,
  selectedId,
  search,
  canManage,
  onSearchChange,
  onSelect,
  onDuplicate,
  onArchive,
  onPreview,
  onImport,
}: FormLibraryPanelProps) {
  const filtered = forms.filter((form) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      form.title.toLowerCase().includes(q)
      || form.formNumber?.toLowerCase().includes(q)
      || form.category?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-3">
      <Input placeholder="Search forms..." value={search} onChange={(e) => onSearchChange(e.target.value)} />
      {canManage && (
        <Button variant="outline" className="w-full" onClick={onImport}>
          <Upload className="h-4 w-4 me-2" />
          Import Existing Form
        </Button>
      )}
      <div className="space-y-2 max-h-[70vh] overflow-y-auto pe-1">
        {filtered.map((form) => (
          <div
            key={form.id}
            className={`rounded-lg border p-3 ${selectedId === form.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}
          >
            <button type="button" className="w-full text-start" onClick={() => onSelect(form.id)}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{form.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {form.formNumber ? `Form ${form.formNumber}` : 'No form number'} · v{form.version}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[form.status]} className="capitalize shrink-0">{form.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {form.category ?? 'General'} · Updated {new Date(form.updatedAt).toLocaleDateString()}
              </p>
              {form.ownerName && (
                <p className="text-xs text-muted-foreground">Owner: {form.ownerName}</p>
              )}
            </button>
            {canManage && (
              <div className="mt-2 flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => onSelect(form.id)}>
                  <Pencil className="h-3.5 w-3.5 me-1" />Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onPreview(form)}>
                  <Eye className="h-3.5 w-3.5 me-1" />Preview
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDuplicate(form)}>
                  <Copy className="h-3.5 w-3.5 me-1" />Duplicate
                </Button>
                {form.status !== 'archived' && (
                  <Button size="sm" variant="ghost" onClick={() => onArchive(form)}>
                    <Archive className="h-3.5 w-3.5 me-1" />Archive
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No forms found.</p>
        )}
      </div>
    </div>
  );
}
