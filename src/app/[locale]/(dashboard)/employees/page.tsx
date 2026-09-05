'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil, Trash2, Eye, Loader2, Link2 } from 'lucide-react';
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
import {
  createEmployee,
  softDeleteEmployee,
  updateEmployee,
} from '@/lib/clinical/employees';
import {
  fetchEmployeesWithPortalLink,
  type EmployeeWithPortalLink,
} from '@/lib/clinical/employee-portal-link';
import {
  employeeFormSchema,
  employeeToForm,
  emptyEmployeeForm,
  type EmployeeFormData,
} from '@/lib/employees/schema';
import {
  formatPortalAccountLabel,
  formatPortalLoginLabel,
  PORTAL_ACCOUNT_REQUIRED_MESSAGE,
} from '@/lib/employees/portal-link';
import type { Employee } from '@/types';
import { ROLES, ROLE_LABELS } from '@/lib/permissions/roles';
import { useRouter } from 'next/navigation';
import { PortalStaffPanel } from '@/components/employees/portal-staff-panel';
import { useRouteReplace } from '@/hooks/use-route-replace';

export default function EmployeesPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('employees.manage');
  const [employees, setEmployees] = useState<EmployeeWithPortalLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeFormData>(() => emptyEmployeeForm());

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchEmployeesWithPortalLink();
    setEmployees(result.data);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const accessDenied = !can('employees.view');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return employees;
    return employees.filter((e) => e.employmentStatus === statusFilter);
  }, [employees, statusFilter]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyEmployeeForm());
    setDialogOpen(true);
  };

  const openEdit = (employee: Employee) => {
    setEditingId(employee.id);
    setForm(employeeToForm(employee));
    setDialogOpen(true);
  };

  const saveEmployee = async () => {
    if (!canManage || !user) return;
    const parsed = employeeFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid form');
      return;
    }
    setSaving(true);
    const result = editingId
      ? await updateEmployee(editingId, parsed.data)
      : await createEmployee(user.id, parsed.data);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to save employee');
      return;
    }
    toast.success(editingId ? 'Employee updated' : 'Employee added');
    setDialogOpen(false);
    void loadEmployees();
  };

  const deleteEmployee = async (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    const result = await softDeleteEmployee(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Employee deleted');
    void loadEmployees();
  };

  const linkPortalAccount = async (employee: EmployeeWithPortalLink) => {
    if (!canManage) return;
    setLinkingId(employee.id);
    try {
      const response = await fetch('/api/employees/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employee.id }),
      });
      const payload = await response.json() as { error?: string; code?: string };
      if (!response.ok) {
        toast.error(payload.error ?? 'Unable to link portal account');
        return;
      }
      toast.success('Portal account linked');
      void loadEmployees();
    } catch {
      toast.error('Unable to link portal account');
    } finally {
      setLinkingId(null);
    }
  };

  const columns: ColumnDef<EmployeeWithPortalLink>[] = useMemo(() => [
    { accessorKey: 'employeeId', header: 'Hospital Staff ID' },
    { accessorKey: 'fullName', header: 'Name' },
    { accessorKey: 'jobTitle', header: 'Title' },
    { accessorKey: 'email', header: 'Email' },
    {
      id: 'portalRole',
      header: 'Portal Role',
      cell: ({ row }) => ROLE_LABELS[row.original.role]?.en ?? row.original.role,
    },
    {
      accessorKey: 'employmentStatus',
      header: tc('status'),
      cell: ({ row }) => (
        <Badge variant={statusBadgeVariant(row.original.employmentStatus)}>{row.original.employmentStatus}</Badge>
      ),
    },
    {
      accessorKey: 'isActive',
      header: 'Active',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'success' : 'secondary'}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'portalAccount',
      header: 'Portal Account',
      cell: ({ row }) => (
        <Badge variant={row.original.portalLink.portalLinked ? 'success' : 'secondary'}>
          {formatPortalAccountLabel(row.original.portalLink)}
        </Badge>
      ),
    },
    {
      id: 'portalLogin',
      header: 'Login Status',
      cell: ({ row }) => formatPortalLoginLabel(row.original.portalLink),
    },
    {
      id: 'portalActions',
      header: 'Account',
      cell: ({ row }) => {
        const { portalLink } = row.original;
        if (portalLink.portalLinked) return null;
        if (portalLink.canLinkByStaffId) {
          return (
            <Button
              size="sm"
              variant="outline"
              disabled={linkingId === row.original.id}
              onClick={() => void linkPortalAccount(row.original)}
            >
              {linkingId === row.original.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Link2 className="h-4 w-4 me-1" />
                  Link Account
                </>
              )}
            </Button>
          );
        }
        return (
          <span className="text-xs text-muted-foreground max-w-[14rem] block">
            {PORTAL_ACCOUNT_REQUIRED_MESSAGE} Ask System Admin to create an account with Hospital Staff ID {row.original.employeeId}.
          </span>
        );
      },
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
              <Button size="sm" variant="ghost" onClick={() => openEdit(row.original)}>
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
  ], [canManage, linkingId, locale, router, tc]);

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
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 me-2" />Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingId ? tc('edit') : 'Add'} Employee</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Hospital Staff ID *</Label>
                  <Input
                    value={form.employeeCode}
                    onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
                    placeholder="Hospital employee ID"
                    disabled={!!editingId}
                  />
                </div>
                <div><Label>Full Name *</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
                <div><Label>Email *</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>Job Title *</Label><Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></div>
                <div><Label>Portal Role *</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Employee['role'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.filter((r) => !['quality_link', 'viewer'].includes(r)).map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r].en}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Employment Status</Label>
                  <Select value={form.employmentStatus} onValueChange={(v) => setForm({ ...form, employmentStatus: v as Employee['employmentStatus'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="on_leave">On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Active in Roster</Label>
                  <Select value={form.isActive ? 'true' : 'false'} onValueChange={(v) => setForm({ ...form, isActive: v === 'true' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => void saveEmployee()} className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tc('save')}
                </Button>
              </div>
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

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <EmptyState title="Failed to load employees" description={error} />
      ) : (
        <DataTable data={filtered} columns={columns} searchKey="fullName" searchPlaceholder="Search employees..." />
      )}

      <PortalStaffPanel canManage={canManage} onStaffUpdated={loadEmployees} />
    </div>
  );
}
