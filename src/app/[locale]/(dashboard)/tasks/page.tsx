'use client';

import { useMemo, useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog, statusBadgeVariant } from '@/lib/page-utils';
import { formatDate, generateId } from '@/lib/utils';
import type { Task } from '@/types';

const STATUSES: Task['status'][] = ['not_started', 'in_progress', 'pending_review', 'completed', 'overdue', 'cancelled'];
const KANBAN_STATUSES: Task['status'][] = ['not_started', 'in_progress', 'pending_review', 'completed'];

export default function TasksPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('tasks.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' as Task['priority'], assignedTo: '', dueDate: '' });
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  if (!can('tasks.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const addTask = () => {
    if (!form.title || !canManage) return;
    const now = new Date().toISOString();
    const task: Task = {
      id: generateId(),
      title: form.title,
      description: form.description,
      assignedTo: form.assignedTo || db.employees[0]?.id || '',
      assignedBy: user?.id || db.employees[0]?.id || '',
      priority: form.priority,
      status: 'not_started',
      startDate: now,
      dueDate: form.dueDate || now,
      recurrence: 'none',
      taskType: 'personal',
      createdAt: now,
      updatedAt: now,
    };
    db.tasks.push(task);
    if (user) appendAuditLog(db, user.id, 'create', 'tasks', task.id);
    saveMockDatabase(db);
    refresh();
    setDialogOpen(false);
    setForm({ title: '', description: '', priority: 'medium', assignedTo: '', dueDate: '' });
    toast.success('Task created');
  };

  const updateStatus = (id: string, status: Task['status']) => {
    if (!canManage) return;
    const task = db.tasks.find((t) => t.id === id);
    if (task) {
      task.status = status;
      task.updatedAt = new Date().toISOString();
      if (user) appendAuditLog(db, user.id, 'update', 'tasks', id);
      saveMockDatabase(db);
      refresh();
    }
  };

  const deleteTask = (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    db.tasks = db.tasks.filter((t) => t.id !== id);
    if (user) appendAuditLog(db, user.id, 'delete', 'tasks', id);
    saveMockDatabase(db);
    refresh();
    toast.success('Task deleted');
  };

  const getEmployeeName = (id: string) => db.employees.find((e) => e.id === id)?.fullName ?? id;

  const columns: ColumnDef<Task>[] = useMemo(() => [
    { accessorKey: 'title', header: 'Title' },
    { accessorKey: 'priority', header: 'Priority', cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.priority)}>{row.original.priority}</Badge> },
    { accessorKey: 'status', header: tc('status'), cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status}</Badge> },
    { accessorKey: 'assignedTo', header: 'Assignee', cell: ({ row }) => getEmployeeName(row.original.assignedTo) },
    { accessorKey: 'dueDate', header: 'Due', cell: ({ row }) => formatDate(row.original.dueDate, locale) },
    {
      id: 'actions', header: tc('actions'),
      cell: ({ row }) => canManage ? (
        <div className="flex gap-1">
          <Select value={row.original.status} onValueChange={(v) => updateStatus(row.original.id, v as Task['status'])}>
            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={() => deleteTask(row.original.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
        </div>
      ) : null,
    },
  ], [canManage, locale, tc, db.employees]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('tasks')}</h1>
          <p className="text-muted-foreground">{db.tasks.length} tasks</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 me-2" />{tc('add')} Task</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{tc('add')} Task</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div><Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Task['priority'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(['low', 'medium', 'high', 'critical'] as const).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Assign To</Label>
                  <Select value={form.assignedTo} onValueChange={(v) => setForm({ ...form, assignedTo: v })}>
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>{db.employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
                <Button onClick={addTask} className="w-full">{tc('save')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">Table View</TabsTrigger>
          <TabsTrigger value="kanban">Kanban Board</TabsTrigger>
        </TabsList>
        <TabsContent value="table">
          <DataTable data={db.tasks} columns={columns} searchKey="title" searchPlaceholder="Search tasks..." />
        </TabsContent>
        <TabsContent value="kanban">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {KANBAN_STATUSES.map((status) => (
              <Card key={status}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    {status.replace('_', ' ')}
                    <Badge variant={statusBadgeVariant(status)}>{db.tasks.filter((t) => t.status === status).length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                  {db.tasks.filter((t) => t.status === status).map((task) => (
                    <div key={task.id} className="rounded-lg border p-3 text-sm space-y-1">
                      <p className="font-medium">{task.title}</p>
                      <Badge variant={statusBadgeVariant(task.priority)} className="text-xs">{task.priority}</Badge>
                      <p className="text-xs text-muted-foreground">{getEmployeeName(task.assignedTo)}</p>
                      {canManage && (
                        <Select value={task.status} onValueChange={(v) => updateStatus(task.id, v as Task['status'])}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{KANBAN_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
