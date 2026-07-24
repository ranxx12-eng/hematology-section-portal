'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Mail, Phone, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/shared/data-table';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase } from '@/lib/mock/store';
import { statusBadgeVariant } from '@/lib/page-utils';
import { formatDate } from '@/lib/utils';
import { ROLE_LABELS } from '@/lib/permissions/roles';
import type { ColumnDef } from '@tanstack/react-table';
import type { Task, TrainingCourse } from '@/types';

export default function EmployeeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can } = useAuth();
  const db = useMemo(() => getMockDatabase(), []);
  const employee = db.employees.find((e) => e.id === id);
  const evaluation = db.evaluations.find((e) => e.employeeId === id);
  const tasks = db.tasks.filter((t) => t.assignedTo === id);
  const supervisor = employee?.supervisorId ? db.employees.find((e) => e.id === employee.supervisorId) : null;

  if (!can('employees.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  if (!employee) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild><Link href={`/${locale}/employees`}><ArrowLeft className="h-4 w-4 me-2" />Back</Link></Button>
        <p className="text-muted-foreground">{tc('noData')}</p>
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
                <p className="text-muted-foreground py-8 text-center">No evaluation on file</p>
              )}
            </TabsContent>
            <TabsContent value="training">
              <DataTable data={db.trainingCourses.slice(0, 4)} columns={trainingColumns} searchKey="title" />
            </TabsContent>
            <TabsContent value="tasks">
              <DataTable data={tasks} columns={taskColumns} searchKey="title" />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
