'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2, Loader2, Pencil, Download } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { EmployeeMultiSelect } from '@/components/shared/employee-multi-select';
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
  exportTasksCsv,
  fetchEmployeeNameMap,
  fetchEmployeeOptions,
  fetchTaskById,
  fetchTasks,
  formatAssigneeNames,
  softDeleteTask,
  updateTask,
} from '@/lib/clinical/tasks';
import { TaskHistoryPanel } from '@/components/tasks/task-history-panel';
import { TaskWorkflowPanel } from '@/components/tasks/task-workflow-panel';
import {
  canApproveTasks,
  canReviewTasks,
  TASK_STATUS_LABELS,
} from '@/lib/tasks/workflow';
import {
  computeTaskSummary,
  emptyTaskForm,
  TASK_PRIORITIES,
  TASK_STATUSES,
  taskFormSchema,
  taskToForm,
  type TaskFormData,
} from '@/lib/tasks/schema';
import type { Task } from '@/types';

const KANBAN_STATUSES: Task['status'][] = ['not_started', 'in_progress', 'pending_review', 'pending_approval', 'completed'];

export default function TasksPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { can, user } = useAuth();
  const canManage = can('tasks.manage');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<Array<{
    id: string;
    fullName: string;
    employeeCode: string;
    portalLinkState: 'linked' | 'not_linked' | 'unknown';
    portalLoginActive: boolean;
  }>>([]);
  const [employeeLoadError, setEmployeeLoadError] = useState<string | null>(null);
  const [portalLinkError, setPortalLinkError] = useState<string | null>(null);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [employeeNames, setEmployeeNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskFormData>(() => emptyTaskForm());
  const [viewScope, setViewScope] = useState<'all' | 'mine'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

  const canReview = user?.role ? canReviewTasks(user.role, can) : false;
  const canApprove = user?.role ? canApproveTasks(user.role, can) : false;

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEmployeesLoading(true);
    const [tasksResult, optionsResult, names] = await Promise.all([
      fetchTasks(),
      fetchEmployeeOptions(),
      fetchEmployeeNameMap(),
    ]);
    setTasks(tasksResult.data);
    setError(tasksResult.error);
    setEmployeeOptions(optionsResult.data);
    setEmployeeLoadError(optionsResult.error);
    setPortalLinkError(optionsResult.portalLinkError);
    setEmployeeNames(names);
    setEmployeesLoading(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!canManage) setViewScope('mine');
  }, [canManage]);

  useEffect(() => {
    const taskId = searchParams.get('task');
    if (!taskId) return;
    void fetchTaskById(taskId).then((res) => {
      if (res.data) setDetailTask(res.data);
    });
  }, [searchParams]);

  const accessDenied = !can('tasks.view');
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const scopedTasks = useMemo(() => {
    if (viewScope === 'mine' && user?.employeeId) {
      return tasks.filter((t) => t.assigneeIds.includes(user.employeeId!));
    }
    return tasks;
  }, [tasks, viewScope, user?.employeeId]);

  const filteredTasks = useMemo(() => scopedTasks.filter((task) => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (assigneeFilter !== 'all' && !task.assigneeIds.includes(assigneeFilter)) return false;
    return true;
  }), [scopedTasks, statusFilter, assigneeFilter]);

  const stats = useMemo(() => computeTaskSummary(scopedTasks), [scopedTasks]);

  if (accessDenied) return null;

  const openCreateDialog = () => {
    setEditTask(null);
    setForm(emptyTaskForm());
    setDialogOpen(true);
  };

  const openEditDialog = (task: Task) => {
    setEditTask(task);
    setForm(taskToForm(task));
    setDialogOpen(true);
  };

  const saveTask = async () => {
    if (!user) return;
    const parsed = taskFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid form');
      return;
    }
    setSaving(true);
    const result = editTask
      ? await updateTask(user.id, editTask.id, parsed.data, editTask.assigneeIds)
      : canManage
        ? await createTask(user.id, parsed.data)
        : { data: null, error: 'Not authorized' };
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to save task');
      return;
    }
    setDialogOpen(false);
    setEditTask(null);
    setForm(emptyTaskForm());
    toast.success(editTask ? 'Task updated' : 'Task created');
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

  const downloadCsv = () => {
    const csv = exportTasksCsv(filteredTasks, employeeNames);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tasks-export.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatAssignees = (task: Task) => formatAssigneeNames(task.assigneeIds, employeeNames);

  const columns: ColumnDef<Task>[] = useMemo(() => [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <button
          type="button"
          className="text-left font-medium hover:underline"
          onClick={() => setDetailTask(row.original)}
        >
          {row.original.title}
        </button>
      ),
    },
    { accessorKey: 'priority', header: 'Priority', cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.priority)}>{row.original.priority}</Badge> },
    { accessorKey: 'status', header: tc('status'), cell: ({ row }) => (
      <Badge variant={statusBadgeVariant(row.original.status)}>
        {TASK_STATUS_LABELS[row.original.status] ?? row.original.status}
      </Badge>
    ) },
    { id: 'assignees', header: 'Assign to', cell: ({ row }) => formatAssignees(row.original) },
    { accessorKey: 'dueDate', header: 'Due', cell: ({ row }) => formatDate(row.original.dueDate, locale) },
    {
      id: 'actions', header: tc('actions'),
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setDetailTask(row.original)}>Open</Button>
          {canManage && (
            <>
              <Button size="sm" variant="ghost" onClick={() => openEditDialog(row.original)}><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => void deleteTask(row.original.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
            </>
          )}
        </div>
      ),
    },
  ], [canManage, locale, tc, employeeNames]);

  const taskFormFields = (
    <div className="space-y-3">
      <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div><Label>Description</Label><Input value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div><Label>Priority</Label>
        <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Task['priority'] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <EmployeeMultiSelect
        employees={employeeOptions}
        selectedIds={form.assigneeIds}
        onChange={(assigneeIds) => setForm({ ...form, assigneeIds })}
        required
        loading={employeesLoading}
        error={employeeLoadError}
        portalLinkError={portalLinkError}
      />
      <div><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
      <Button onClick={() => void saveTask()} className="w-full" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tc('save')}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('tasks')}</h1>
          <p className="text-muted-foreground">{filteredTasks.length} tasks</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadCsv} disabled={filteredTasks.length === 0}>
            <Download className="h-4 w-4 me-2" />Export CSV
          </Button>
          {canManage && (
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditTask(null); setForm(emptyTaskForm()); } }}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}><Plus className="h-4 w-4 me-2" />{tc('add')} Task</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editTask ? 'Edit Task' : `${tc('add')} Task`}</DialogTitle></DialogHeader>
                {taskFormFields}
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <Tabs value={viewScope} onValueChange={(v) => setViewScope(v as 'all' | 'mine')}>
          <TabsList>
            {canManage && <TabsTrigger value="all">All Tasks</TabsTrigger>}
            <TabsTrigger value="mine">My Tasks</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {canManage && (
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Assignee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              {employeeOptions.map((e) => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}
            </SelectContent>
          </Select>
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
            {filteredTasks.length === 0 ? (
              <EmptyState title={tc('noData')} description={viewScope === 'mine' ? 'No tasks assigned to you.' : 'No tasks yet.'} />
            ) : (
              <DataTable data={filteredTasks} columns={columns} searchKey="title" searchPlaceholder="Search tasks..." />
            )}
          </TabsContent>
          <TabsContent value="kanban">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {KANBAN_STATUSES.map((status) => (
                <Card key={status}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      {status.replace('_', ' ')}
                      <Badge variant={statusBadgeVariant(status)}>{filteredTasks.filter((t) => t.status === status).length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredTasks.filter((t) => t.status === status).map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        className="w-full rounded-lg border p-3 text-sm space-y-1 text-left hover:bg-muted/40 transition-colors"
                        onClick={() => setDetailTask(task)}
                      >
                        <p className="font-medium">{task.title}</p>
                        <Badge variant={statusBadgeVariant(task.priority)} className="text-xs">{task.priority}</Badge>
                        <p className="text-xs text-muted-foreground">{formatAssignees(task)}</p>
                        <Badge variant={statusBadgeVariant(task.status)} className="text-xs">
                          {TASK_STATUS_LABELS[task.status]}
                        </Badge>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={Boolean(detailTask)} onOpenChange={(open) => !open && setDetailTask(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{detailTask?.title}</DialogTitle></DialogHeader>
          {detailTask && (
            <div className="space-y-3 text-sm">
              {detailTask.description && (
                <div>
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p>{detailTask.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Assign to</p>
                  <p>{formatAssignees(detailTask)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due date</p>
                  <p>{formatDate(detailTask.dueDate, locale)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Priority</p>
                  <Badge variant={statusBadgeVariant(detailTask.priority)}>{detailTask.priority}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={statusBadgeVariant(detailTask.status)}>
                    {TASK_STATUS_LABELS[detailTask.status]}
                  </Badge>
                </div>
              </div>
              <TaskWorkflowPanel
                task={detailTask}
                employeeId={user?.employeeId}
                canManage={canManage}
                canReview={canReview}
                canApprove={canApprove}
                onComplete={() => {
                  void loadTasks();
                  void fetchTaskById(detailTask.id).then((res) => {
                    if (res.data) setDetailTask(res.data);
                  });
                }}
              />
              <div>
                <p className="text-sm font-medium mb-2">Workflow History</p>
                <TaskHistoryPanel taskId={detailTask.id} nameMap={employeeNames} />
              </div>
              {canManage && (
                <Button variant="outline" className="w-full" onClick={() => { setDetailTask(null); openEditDialog(detailTask); }}>
                  <Pencil className="h-4 w-4 me-2" />Edit Task
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
