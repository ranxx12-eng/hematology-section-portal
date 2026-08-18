'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { statusBadgeVariant } from '@/lib/page-utils';
import { formatDate } from '@/lib/utils';
import {
  createTrainingCourse,
  fetchTrainingCourses,
  softDeleteTrainingCourse,
} from '@/lib/clinical/training';
import {
  emptyTrainingCourseForm,
  trainingCourseFormSchema,
  type TrainingCourseFormData,
} from '@/lib/training/schema';
import type { TrainingCourse } from '@/types';

export default function TrainingPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('training.manage');
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<TrainingCourseFormData>(() => emptyTrainingCourseForm());

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchTrainingCourses();
    setCourses(result.data);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  const accessDenied = !can('training.view');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  const addCourse = async () => {
    if (!canManage || !user) return;
    const parsed = trainingCourseFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid form');
      return;
    }
    setSaving(true);
    const result = await createTrainingCourse(user.id, parsed.data);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to add course');
      return;
    }
    setDialogOpen(false);
    setForm(emptyTrainingCourseForm());
    toast.success('Course added');
    void loadCourses();
  };

  const deleteCourse = async (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    const result = await softDeleteTrainingCourse(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Course deleted');
    void loadCourses();
  };

  const columns: ColumnDef<TrainingCourse>[] = useMemo(() => [
    { accessorKey: 'title', header: 'Course' },
    { accessorKey: 'category', header: 'Category', cell: ({ row }) => <Badge variant="outline">{row.original.category}</Badge> },
    { accessorKey: 'instructor', header: 'Instructor' },
    { accessorKey: 'dueDate', header: 'Due Date', cell: ({ row }) => formatDate(row.original.dueDate, locale) },
    { accessorKey: 'passingScore', header: 'Pass Score', cell: ({ row }) => `${row.original.passingScore}%` },
    { accessorKey: 'status', header: tc('status'), cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status}</Badge> },
    {
      id: 'actions', header: tc('actions'),
      cell: ({ row }) => canManage ? (
        <Button size="sm" variant="ghost" onClick={() => deleteCourse(row.original.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
      ) : null,
    },
  ], [canManage, locale, tc]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('training')}</h1>
          <p className="text-muted-foreground">{courses.length} training courses</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{tc('add')}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{tc('add')} Training Course</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div><Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{['SOP', 'Safety', 'Quality', 'Technical'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Instructor</Label><Input value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} /></div>
                <div><Label>Passing Score (%)</Label><Input type="number" value={form.passingScore} onChange={(e) => setForm({ ...form, passingScore: Number(e.target.value) })} /></div>
                <Button onClick={addCourse} className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tc('save')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <EmptyState title="Failed to load training courses" description={error} />
      ) : courses.length === 0 ? (
        <EmptyState title={tc('noData')} description="No training courses yet." />
      ) : (
        <DataTable data={courses} columns={columns} searchKey="title" searchPlaceholder="Search courses..." />
      )}
    </div>
  );
}
