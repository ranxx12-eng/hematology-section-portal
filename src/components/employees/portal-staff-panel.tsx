'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { StaffIdentity } from '@/components/shared/staff-identity';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchPortalStaff, updatePortalStaffId } from '@/lib/clinical/staff-profiles';
import { ROLE_LABELS } from '@/lib/permissions/roles';
import { STAFF_ID_REQUIRED_MESSAGE } from '@/lib/employees/portal-link';
import { STAFF_ID_NOT_ASSIGNED, type StaffIdentity as StaffIdentityType } from '@/lib/staff/identity';

interface PortalStaffPanelProps {
  canManage: boolean;
  onStaffUpdated?: () => void;
}

export function PortalStaffPanel({ canManage, onStaffUpdated }: PortalStaffPanelProps) {
  const [staff, setStaff] = useState<StaffIdentityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<StaffIdentityType | null>(null);
  const [staffIdInput, setStaffIdInput] = useState('');

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPortalStaff();
    setStaff(result.data);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const openEdit = (member: StaffIdentityType) => {
    setEditing(member);
    setStaffIdInput(member.staffId ?? '');
  };

  const saveStaffId = async () => {
    if (!editing) return;
    setSaving(true);
    const normalized = staffIdInput.trim();
    const duplicate = staff.find(
      (member) => member.profileId !== editing.profileId
        && member.staffId
        && normalized
        && member.staffId.toLowerCase() === normalized.toLowerCase(),
    );
    if (duplicate) {
      setSaving(false);
      toast.error(`Staff ID already assigned to ${duplicate.fullName}`);
      return;
    }

    const result = await updatePortalStaffId(editing.profileId, normalized || null);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Hospital Staff ID updated');
    setEditing(null);
    void loadStaff();
    onStaffUpdated?.();
  };

  const columns: ColumnDef<StaffIdentityType>[] = useMemo(() => [
    {
      accessorKey: 'fullName',
      header: 'Staff Name',
      cell: ({ row }) => (
        <StaffIdentity fullName={row.original.fullName} staffId={row.original.staffId} />
      ),
    },
    { accessorKey: 'email', header: 'Email' },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => ROLE_LABELS[row.original.role]?.en ?? row.original.role,
    },
    {
      accessorKey: 'staffId',
      header: 'Hospital Staff ID',
      cell: ({ row }) => row.original.staffId ?? STAFF_ID_NOT_ASSIGNED,
    },
    {
      id: 'employeeLink',
      header: 'Employee Record',
      cell: ({ row }) => {
        if (!row.original.staffId) {
          return (
            <Badge variant="destructive">
              Hospital Staff ID required
            </Badge>
          );
        }
        if (row.original.employeeLinked) {
          return <Badge variant="success">Linked</Badge>;
        }
        return <Badge variant="secondary">Awaiting link</Badge>;
      },
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'success' : 'secondary'}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => canManage ? (
        <Button size="sm" variant="ghost" onClick={() => openEdit(row.original)}>
          <Pencil className="h-4 w-4" />
        </Button>
      ) : null,
    },
  ], [canManage]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Portal Staff Accounts</CardTitle>
          <p className="text-sm text-muted-foreground">
            Active login accounts. Hospital Staff ID is the visible operational identifier; internal UUIDs are not shown.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <DataTable
              data={staff}
              columns={columns}
              searchKey="fullName"
              searchPlaceholder="Search by name, email, or staff ID..."
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Hospital Staff ID</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <StaffIdentity fullName={editing.fullName} staffId={editing.staffId} />
              <div className="space-y-2">
                <Label htmlFor="staffId">Hospital Staff ID</Label>
                <Input
                  id="staffId"
                  value={staffIdInput}
                  onChange={(e) => setStaffIdInput(e.target.value)}
                  placeholder="Enter hospital staff / employee ID"
                />
                <p className="text-xs text-muted-foreground">
                  {STAFF_ID_REQUIRED_MESSAGE} Leave blank to mark as {STAFF_ID_NOT_ASSIGNED}. Staff cannot edit their own ID.
                </p>
              </div>
              <Button onClick={() => void saveStaffId()} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Staff ID'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
