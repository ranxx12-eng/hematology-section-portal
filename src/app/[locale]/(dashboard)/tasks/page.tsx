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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { statusBadgeVariant } from '@/lib/page-utils';
import { formatDate } from '@/lib/utils';
import {
  createTask,
  fetchEmployeeNameMap,
  fetchEmployeeOptions,
  fetchTasks,
  softDeleteTask,
  updateTaskStatus,
} from '@/lib/clinical/tasks';
import {
  computeTaskSummary,
  emptyTaskForm,
  TASK_PRIORITIES,
  TASK_STATUSES,
  taskFormSchema,
  type TaskFormData,
} from '@/lib/tasks/schema';
import type { Task } from '@/types';

const KANBAN_STATUSES: Task['status'][] = ['not_started', 'in_progress', 'pending_review', 'completed'];

export default function TasksPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('tasks.manage');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<{ id: string; fullName: string }[]>([]);
  const [employeeNames, setEmployeeNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<TaskFormData>(() => emptyTaskForm());

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [tasksResult, options, names] = await Promise.all([
      fetchTasks(),
      fetchEmployeeOptions(),
      fetchEmployeeNameMap(),
    ]);
    setTasks(tasksResult.data);
    setError(tasksResult.error);
    setEmployeeOptions(options);
    setEmployeeNames(names);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const accessDenied = !can('tasks.view');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  const stats = useMemo(() => computeTaskSummary(tasks), [tasks]);

  const addTask = async () => {
    if (!canManage || !user) return;
    const parsed = taskFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid form');
      return;
    }
    setSaving(true);
    const result = await createTask(user.id, parsed.data);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to create task');
      return;
    }
    setDialogOpen(false);
    setForm(emptyTaskForm());
    toast.success('Task created');
    void loadTasks();
  };

  const updateStatus = async (id: string, status: Task['status']) => {
    if (!canManage) return;
    const result = await updateTaskStatus(id, status);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    void loadTasks();
  };

  const deleteTask = async (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    const result = await softDeleteTask(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Task deleted');
    void loadTasks();
  };

  const getEmployeeName = (id: string) => employeeNames[id] ?? id;

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
            <SelectContent>{TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={() => deleteTask(row.original.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
        </div>
      ) : null,
    },
  ], [canManage, locale, tc, employeeNames]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('tasks')}</h1>
          <p className="text-muted-foreground">{tasks.length} tasks</p>
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
                <div><Label>Description</Label><Input value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div><Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Task['priority'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Assign To</Label>
                  <Select value={form.assignedTo} onValueChange={(v) => setForm({ ...form, assignedTo: v })}>
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>{employeeOptions.map((e) => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
                <Button onClick={addTask} className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tc('save')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Open</p><p className="text-2xl font-bold">{stats.open}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Overdue</p><p className="text-2xl font-bold text-destructive">{stats.overdue}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">In Progress</p><p className="text-2xl font-bold text-accent">{stats.inProgress}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Completed</p><p className="text-2xl font-bold text-success">{stats.completed}</p></CardContent></Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <EmptyState title="Failed to load tasks" description={error} />
      ) : (
        <Tabs defaultValue="table">
          <TabsList>
            <TabsTrigger value="table">Table View</TabsTrigger>
            <TabsTrigger value="kanban">Kanban Board</TabsTrigger>
          </TabsList>
          <TabsContent value="table">
            {tasks.length === 0 ? (
              <EmptyState title={tc('noData')} description="No tasks yet." />
            ) : (
              <DataTable data={tasks} columns={columns} searchKey="title" searchPlaceholder="Search tasks..." />
            )}
          </TabsContent>
          <TabsContent value="kanban">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {KANBAN_STATUSES.map((status) => (
                <Card key={status}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      {status.replace('_', ' ')}
                      <Badge variant={statusBadgeVariant(status)}>{tasks.filter((t) => t.status === status).length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                    {tasks.filter((t) => t.status === status).map((task) => (
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
      )}
    </div>
  );
}
