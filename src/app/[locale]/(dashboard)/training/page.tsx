'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog, statusBadgeVariant } from '@/lib/page-utils';
import { formatDate, generateId } from '@/lib/utils';
import type { TrainingCourse } from '@/types';

export default function TrainingPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('training.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'SOP', instructor: '', passingScore: '80' });
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  if (!can('training.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const addCourse = () => {
    if (!form.title || !canManage) return;
    const now = new Date().toISOString();
    const course: TrainingCourse = {
      id: generateId(),
      title: form.title,
      description: form.description,
      category: form.category,
      instructor: form.instructor || db.employees[0]?.fullName || '',
      startDate: now,
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      passingScore: parseInt(form.passingScore, 10) || 80,
      status: 'active',
      createdAt: now,
    };
    db.trainingCourses.unshift(course);
    if (user) appendAuditLog(db, user.id, 'create', 'training', course.id);
    saveMockDatabase(db);
    refresh();
    setDialogOpen(false);
    toast.success('Course added');
  };

  const deleteCourse = (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    db.trainingCourses = db.trainingCourses.filter((c) => c.id !== id);
    if (user) appendAuditLog(db, user.id, 'delete', 'training', id);
    saveMockDatabase(db);
    refresh();
    toast.success('Course deleted');
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
          <p className="text-muted-foreground">{db.trainingCourses.length} training courses</p>
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
                <div><Label>Passing Score (%)</Label><Input type="number" value={form.passingScore} onChange={(e) => setForm({ ...form, passingScore: e.target.value })} /></div>
                <Button onClick={addCourse} className="w-full">{tc('save')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <DataTable data={db.trainingCourses} columns={columns} searchKey="title" searchPlaceholder="Search courses..." />
    </div>
  );
}
