'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/providers/auth-provider';
import { ROLE_LABELS } from '@/lib/permissions/roles';
import { formatStaffIdLabel, STAFF_ID_NOT_ASSIGNED } from '@/lib/staff/identity';
import { updatePortalStaffId } from '@/lib/clinical/staff-profiles';

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  staffId: string | null;
  isActive: boolean;
}

export function UserManagementPanel() {
  const { user, role, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [staffEditUser, setStaffEditUser] = useState<AdminUser | null>(null);
  const [staffIdInput, setStaffIdInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isSystemAdmin = role === 'system_admin';

  const passwordTooShort = newPassword.length > 0 && newPassword.length < 8;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmitPassword = useMemo(
    () => newPassword.length >= 8 && confirmPassword.length >= 8 && newPassword === confirmPassword,
    [newPassword, confirmPassword],
  );

  const loadUsers = useCallback(async () => {
    if (!isSystemAdmin) {
      setLoading(false);
      setUsers([]);
      setLoadError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();

      if (!response.ok) {
        const message = data.error ?? 'Unable to load users.';
        setLoadError(message);
        toast.error(message);
        setUsers([]);
        return;
      }

      setUsers(data.users ?? []);
    } catch {
      const message = 'Unable to load users.';
      setLoadError(message);
      toast.error(message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [isSystemAdmin]);

  useEffect(() => {
    if (authLoading) return;
    void loadUsers();
  }, [authLoading, loadUsers]);

  const closeDialog = () => {
    setSelectedUser(null);
    setNewPassword('');
    setConfirmPassword('');
  };

  const openResetDialog = (adminUser: AdminUser) => {
    setSelectedUser(adminUser);
    setNewPassword('');
    setConfirmPassword('');
  };

  const openStaffEditDialog = (adminUser: AdminUser) => {
    setStaffEditUser(adminUser);
    setStaffIdInput(adminUser.staffId ?? '');
  };

  const handleSaveStaffId = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!staffEditUser) return;

    setSubmitting(true);
    try {
      const result = await updatePortalStaffId(
        staffEditUser.id,
        staffIdInput.trim() || null,
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Staff ID updated for ${staffEditUser.fullName}.`);
      setStaffEditUser(null);
      void loadUsers();
    } catch {
      toast.error('Unable to update staff ID.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUser) return;

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? 'Unable to reset password.');
        return;
      }

      toast.success(`Password reset for ${selectedUser.email}.`);
      closeDialog();
    } catch {
      toast.error('Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>User Management</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading session…</p>
        </CardContent>
      </Card>
    );
  }

  if (!isSystemAdmin) {
    return (
      <Card>
        <CardHeader><CardTitle>User Management</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Password reset requires the <span className="font-medium">system_admin</span> role.
            {user ? ` You are signed in as ${user.email} (${role ?? 'unknown role'}).` : ''}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>User Management</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Signed in as {user?.email} — system administrator
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadUsers()} disabled={loading}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading users…</p>
          ) : loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found in Supabase profiles.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-start p-3 font-medium">Name</th>
                    <th className="text-start p-3 font-medium">Email</th>
                    <th className="text-start p-3 font-medium">Staff ID</th>
                    <th className="text-start p-3 font-medium">Role</th>
                    <th className="text-start p-3 font-medium">Status</th>
                    <th className="text-end p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((adminUser) => (
                    <tr key={adminUser.id} className="border-t border-border">
                      <td className="p-3 font-medium">{adminUser.fullName}</td>
                      <td className="p-3 text-muted-foreground">{adminUser.email}</td>
                      <td className="p-3 text-muted-foreground">{adminUser.staffId ?? STAFF_ID_NOT_ASSIGNED}</td>
                      <td className="p-3">
                        <Badge variant="outline">
                          {ROLE_LABELS[adminUser.role as keyof typeof ROLE_LABELS]?.en ?? adminUser.role}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {adminUser.isActive ? (
                          <Badge>Active</Badge>
                        ) : (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </td>
                      <td className="p-3 text-end">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openStaffEditDialog(adminUser)}>
                            Edit Staff ID
                          </Button>
                          <Button size="sm" onClick={() => openResetDialog(adminUser)}>
                            <KeyRound className="h-4 w-4 me-1" />
                            Reset Password
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedUser)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Set a new password for{' '}
                <span className="font-medium text-foreground">{selectedUser.fullName}</span>{' '}
                (<span className="font-medium text-foreground">{selectedUser.email}</span>).
              </p>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                {passwordTooShort && (
                  <p className="text-xs text-destructive">Password must be at least 8 characters.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                {passwordsMismatch && (
                  <p className="text-xs text-destructive">Passwords do not match.</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeDialog} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !canSubmitPassword}>
                  {submitting ? 'Resetting…' : 'Reset Password'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(staffEditUser)} onOpenChange={(open) => !open && setStaffEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Hospital Staff ID</DialogTitle>
          </DialogHeader>
          {staffEditUser && (
            <form onSubmit={handleSaveStaffId} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {staffEditUser.fullName} ({staffEditUser.email})
              </p>
              <div className="space-y-2">
                <Label htmlFor="staffId">Hospital Staff ID</Label>
                <Input
                  id="staffId"
                  value={staffIdInput}
                  onChange={(e) => setStaffIdInput(e.target.value)}
                  placeholder="Enter hospital staff / employee ID"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setStaffEditUser(null)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save Staff ID'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
