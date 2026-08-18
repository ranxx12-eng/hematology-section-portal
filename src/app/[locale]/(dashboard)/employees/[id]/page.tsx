'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Mail, Phone, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/components/providers/auth-provider';
import { statusBadgeVariant } from '@/lib/page-utils';
import { formatDate } from '@/lib/utils';
import { ROLE_LABELS } from '@/lib/permissions/roles';
import type { ColumnDef } from '@tanstack/react-table';
import type { Employee, EmployeeEvaluation, Task, TrainingCourse } from '@/types';
import {
  fetchEmployeeById,
  fetchEmployees,
  fetchLatestEmployeeEvaluation,
} from '@/lib/clinical/employees';
import { fetchTasksForEmployee } from '@/lib/clinical/tasks';
import { fetchTrainingCoursesForEmployee } from '@/lib/clinical/training';

export default function EmployeeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [supervisor, setSupervisor] = useState<Employee | null>(null);
  const [evaluation, setEvaluation] = useState<EmployeeEvaluation | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [employeeResult, tasksResult, coursesResult, evaluationResult, allEmployees] = await Promise.all([
      fetchEmployeeById(id),
      fetchTasksForEmployee(id),
      fetchTrainingCoursesForEmployee(id),
      fetchLatestEmployeeEvaluation(id),
      fetchEmployees(),
    ]);
    if (employeeResult.error || !employeeResult.data) {
      setError(employeeResult.error ?? 'Employee not found');
      setEmployee(null);
    } else {
      setEmployee(employeeResult.data);
      setSupervisor(
        employeeResult.data.supervisorId
          ? allEmployees.data.find((e) => e.id === employeeResult.data!.supervisorId) ?? null
          : null,
      );
    }
    setTasks(tasksResult.data);
    setCourses(coursesResult.data);
    setEvaluation(evaluationResult.data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const accessDenied = !can('employees.view');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild><Link href={`/${locale}/employees`}><ArrowLeft className="h-4 w-4 me-2" />Back</Link></Button>
        <EmptyState title={tc('noData')} description={error ?? 'Employee not found'} />
      </div>
    );
  }

  const taskColumns: ColumnDef<Task>[] = [
    { accessorKey: 'title', header: 'Task' },
    { accessorKey: 'priority', header: 'Priority', cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.priority)}>{row.original.priority}</Badge> },
    { accessorKey: 'status', header: tc('status'), cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status}</Badge> },
    { accessorKey: 'dueDate', header: 'Due', cell: ({ row }) => formatDate(row.original.dueDate, locale) },
  ];

  const trainingColumns: ColumnDef<TrainingCourse>[] = [
    { accessorKey: 'title', header: 'Course' },
    { accessorKey: 'category', header: 'Category' },
    { accessorKey: 'dueDate', header: 'Due', cell: ({ row }) => formatDate(row.original.dueDate, locale) },
    { accessorKey: 'status', header: tc('status'), cell: ({ row }) => <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link href={`/${locale}/employees`}><ArrowLeft className="h-4 w-4 me-2" />{tc('employees')}</Link>
      </Button>

      <div className="flex flex-col md:flex-row gap-6">
        <Card className="md:w-80">
          <CardHeader>
            <CardTitle>{employee.fullName}</CardTitle>
            <p className="text-sm text-muted-foreground">{employee.employeeId}</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Badge>{ROLE_LABELS[employee.role]?.en ?? employee.role}</Badge>
            <Badge variant={statusBadgeVariant(employee.employmentStatus)}>{employee.employmentStatus}</Badge>
            <p className="flex items-center gap-2"><Mail className="h-4 w-4" />{employee.email}</p>
            {employee.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4" />{employee.phone}</p>}
            <p className="flex items-center gap-2"><Calendar className="h-4 w-4" />Hired {formatDate(employee.hireDate, locale)}</p>
            <p>Shift: <Badge variant="outline">{employee.shift}</Badge></p>
            {supervisor && <p>Supervisor: {supervisor.fullName}</p>}
          </CardContent>
        </Card>

        <div className="flex-1">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="fte">FTE / Evaluation</TabsTrigger>
              <TabsTrigger value="training">Training</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Employee Details</CardTitle></CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Job Title</span><p className="font-medium">{employee.jobTitle}</p></div>
                  <div><span className="text-muted-foreground">Section</span><p className="font-medium">{employee.section}</p></div>
                  <div><span className="text-muted-foreground">Active</span><p className="font-medium">{employee.isActive ? 'Yes' : 'No'}</p></div>
                  {employee.notes && <div className="sm:col-span-2"><span className="text-muted-foreground">Notes</span><p>{employee.notes}</p></div>}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="fte">
              {evaluation ? (
                <Card>
                  <CardHeader><CardTitle>Evaluation — {evaluation.period}</CardTitle></CardHeader>
                  <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div><p className="text-sm text-muted-foreground">FTE</p><p className="text-2xl font-bold">{evaluation.fte}</p></div>
                    <div><p className="text-sm text-muted-foreground">Final Score</p><p className="text-2xl font-bold">{evaluation.finalScore.toFixed(2)}</p></div>
                    <div><p className="text-sm text-muted-foreground">Rating</p><Badge variant="success">{evaluation.rating}</Badge></div>
                    <div><p className="text-sm text-muted-foreground">Staff Eval</p><p>{evaluation.staffEvaluation}/5</p></div>
                    <div><p className="text-sm text-muted-foreground">Supervisor Eval</p><p>{evaluation.supervisorEvaluation}/5</p></div>
                    {evaluation.strengths && <div className="sm:col-span-2"><p className="text-sm text-muted-foreground">Strengths</p><p>{evaluation.strengths}</p></div>}
                  </CardContent>
                </Card>
              ) : (
                <EmptyState title={tc('noData')} description="No evaluation on file" />
              )}
            </TabsContent>
            <TabsContent value="training">
              {courses.length === 0 ? (
                <EmptyState title={tc('noData')} description="No training enrollments" />
              ) : (
                <DataTable data={courses} columns={trainingColumns} searchKey="title" />
              )}
            </TabsContent>
            <TabsContent value="tasks">
              {tasks.length === 0 ? (
                <EmptyState title={tc('noData')} description="No assigned tasks" />
              ) : (
                <DataTable data={tasks} columns={taskColumns} searchKey="title" />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
