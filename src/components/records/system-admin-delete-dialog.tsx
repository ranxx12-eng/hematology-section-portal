'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface SystemAdminDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (deleteReason?: string) => Promise<void>;
  saving?: boolean;
}

export function SystemAdminDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  saving = false,
}: SystemAdminDeleteDialogProps) {
  const [deleteReason, setDeleteReason] = useState('');

  const handleOpenChange = (next: boolean) => {
    if (!next) setDeleteReason('');
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    await onConfirm(deleteReason.trim() || undefined);
    setDeleteReason('');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this record?</DialogTitle>
          <p className="text-sm text-muted-foreground">
            This record will be removed from normal operational views but retained in audit history
            and can be restored by system administration.
          </p>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-reason">Delete reason (optional)</Label>
          <Textarea
            id="delete-reason"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="Brief reason for deletion"
            rows={3}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={() => void handleConfirm()} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface RestoreRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: string;
  onConfirm: () => Promise<void>;
  saving?: boolean;
}

export function RestoreRecordDialog({
  open,
  onOpenChange,
  summary,
  onConfirm,
  saving = false,
}: RestoreRecordDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restore this record?</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {summary}
          </p>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void onConfirm()} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            Restore
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
