'use client';

import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil, Trash2, Eye } from 'lucide-react';
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
import type { Employee } from '@/types';
import { ROLES, ROLE_LABELS } from '@/lib/permissions/roles';
import { useRouter } from 'next/navigation';

const emptyEmployee = (): Partial<Employee> => ({
  fullName: '', email: '', phone: '', jobTitle: '', role: 'lab_technologist',
  section: 'Hematology', employmentStatus: 'active', shift: 'morning', isActive: true,
});

export default function EmployeesPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('employees.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Employee> | null>(null);

  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  const filtered = useMemo(() => {
    let list = db.employees;
    if (statusFilter !== 'all') list = list.filter((e) => e.employmentStatus === statusFilter);
    return list;
  }, [db.employees, statusFilter]);

  const saveEmployee = () => {
    if (!editing?.fullName || !editing.email || !canManage) return;
    const now = new Date().toISOString();
    if (editing.id) {
      const idx = db.employees.findIndex((e) => e.id === editing.id);
      if (idx >= 0) {
        db.employees[idx] = { ...db.employees[idx], ...editing, updatedAt: now } as Employee;
        if (user) appendAuditLog(db, user.id, 'update', 'employees', editing.id);
      }
      toast.success('Employee updated');
    } else {
      const newEmp: Employee = {
        id: generateId(),
        employeeId: `HEM-${String(db.employees.length + 1).padStart(4, '0')}`,
        fullName: editing.fullName!,
        email: editing.email!,
        phone: editing.phone,
        jobTitle: editing.jobTitle || 'Lab Technologist',
        role: (editing.role as Employee['role']) || 'lab_technologist',
        section: editing.section || 'Hematology',
        hireDate: now,
        employmentStatus: (editing.employmentStatus as Employee['employmentStatus']) || 'active',
        shift: (editing.shift as Employee['shift']) || 'morning',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      db.employees.push(newEmp);
      if (user) appendAuditLog(db, user.id, 'create', 'employees', newEmp.id);
      toast.success('Employee added');
    }
    saveMockDatabase(db);
    refresh();
    setDialogOpen(false);
    setEditing(null);
  };

  const deleteEmployee = (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    db.employees = db.employees.filter((e) => e.id !== id);
    if (user) appendAuditLog(db, user.id, 'delete', 'employees', id);
    saveMockDatabase(db);
    refresh();
    toast.success('Employee deleted');
  };

  const columns: ColumnDef<Employee>[] = useMemo(() => [
    { accessorKey: 'employeeId', header: 'ID' },
    { accessorKey: 'fullName', header: 'Name' },
    { accessorKey: 'jobTitle', header: 'Title' },
    { accessorKey: 'email', header: 'Email' },
    {
      accessorKey: 'employmentStatus',
      header: tc('status'),
      cell: ({ row }) => (
        <Badge variant={statusBadgeVariant(row.original.employmentStatus)}>{row.original.employmentStatus}</Badge>
      ),
    },
    {
      accessorKey: 'shift',
      header: 'Shift',
      cell: ({ row }) => <Badge variant="outline">{row.original.shift}</Badge>,
    },
    {
      id: 'actions',
      header: tc('actions'),
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => router.push(`/${locale}/employees/${row.original.id}`)}>
            <Eye className="h-4 w-4" />
          </Button>
          {canManage && (
            <>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(row.original); setDialogOpen(true); }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => deleteEmployee(row.original.id)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ], [canManage, locale, router, tc]);

  if (!can('employees.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('employees')}</h1>
          <p className="text-muted-foreground">{filtered.length} staff members</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(emptyEmployee())}>
                <Plus className="h-4 w-4 me-2" />{tc('add')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing?.id ? tc('edit') : tc('add')} Employee</DialogTitle></DialogHeader>
              {editing && (
                <div className="space-y-3">
                  <div><Label>Full Name</Label><Input value={editing.fullName || ''} onChange={(e) => setEditing({ ...editing, fullName: e.target.value })} /></div>
                  <div><Label>Email</Label><Input value={editing.email || ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
                  <div><Label>Job Title</Label><Input value={editing.jobTitle || ''} onChange={(e) => setEditing({ ...editing, jobTitle: e.target.value })} /></div>
                  <div><Label>Role</Label>
                    <Select value={editing.role} onValueChange={(v) => setEditing({ ...editing, role: v as Employee['role'] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r].en}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Status</Label>
                    <Select value={editing.employmentStatus} onValueChange={(v) => setEditing({ ...editing, employmentStatus: v as Employee['employmentStatus'] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="on_leave">On Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={saveEmployee} className="w-full">{tc('save')}</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex gap-3 items-center">
        <Label>{tc('filter')}:</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="on_leave">On Leave</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable data={filtered} columns={columns} searchKey="fullName" searchPlaceholder="Search employees..." />
    </div>
  );
}
