'use client';

import { useCallback, useEffect, useState } from 'react';
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

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
}

export function UserManagementPanel() {
  const { user, role } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isSystemAdmin = role === 'system_admin';

  const loadUsers = useCallback(async () => {
    if (!isSystemAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? 'Unable to load users.');
        setUsers([]);
        return;
      }

      setUsers(data.users ?? []);
    } catch {
      toast.error('Unable to load users.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [isSystemAdmin]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const closeDialog = () => {
    setSelectedUser(null);
    setNewPassword('');
    setConfirmPassword('');
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

  if (!isSystemAdmin) {
    return (
      <Card>
        <CardHeader><CardTitle>User Management</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Password reset and user administration require the system_admin role.
            {user ? ` You are signed in as ${user.email} (${role}).` : ''}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>User Management</CardTitle>
          <Button variant="outline" size="sm" onClick={() => void loadUsers()} disabled={loading}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading users…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found.</p>
          ) : (
            users.map((adminUser) => (
              <div
                key={adminUser.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-sm">{adminUser.fullName}</p>
                  <p className="text-xs text-muted-foreground">{adminUser.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {ROLE_LABELS[adminUser.role as keyof typeof ROLE_LABELS]?.en ?? adminUser.role}
                  </Badge>
                  {!adminUser.isActive && <Badge variant="destructive">Inactive</Badge>}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedUser(adminUser);
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                  >
                    <KeyRound className="h-4 w-4 me-1" />
                    Reset Password
                  </Button>
                </div>
              </div>
            ))
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
                Set a new password for <span className="font-medium text-foreground">{selectedUser.email}</span>.
              </p>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeDialog} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Resetting…' : 'Reset Password'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
