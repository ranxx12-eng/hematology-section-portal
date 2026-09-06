'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StaffIdentity } from '@/components/shared/staff-identity';
import type { Permission } from '@/lib/permissions/roles';
import {
  canApproveStainQcSheet,
  canReviewStainQcSheet,
  canSubmitStainQcSheet,
  isStainQcSheetEditable,
} from '@/lib/stain-qc/permissions';
import { STAIN_QC_STATUS_LABELS } from '@/lib/stain-qc/constants';
import type { StainQcMonthlySheet } from '@/types/stain-qc';

interface StainQcWorkflowPanelProps {
  sheet: StainQcMonthlySheet;
  userId: string;
  can: (permission: Permission) => boolean;
  saving?: boolean;
  onSubmit: () => Promise<void>;
  onReview: () => Promise<void>;
  onApprove: () => Promise<void>;
}

export function StainQcWorkflowPanel({
  sheet,
  userId,
  can,
  saving,
  onSubmit,
  onReview,
  onApprove,
}: StainQcWorkflowPanelProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Workflow · {STAIN_QC_STATUS_LABELS[sheet.status] ?? sheet.status}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <div className="text-muted-foreground mb-1">Submitted By</div>
            <StaffIdentity fullName={sheet.submittedByName ?? '—'} staffId={sheet.submittedByStaffId} />
            {sheet.submittedAt && <div className="text-xs text-muted-foreground mt-1">{new Date(sheet.submittedAt).toLocaleString()}</div>}
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Reviewed By</div>
            <StaffIdentity fullName={sheet.reviewedByName ?? '—'} staffId={sheet.reviewedByStaffId} />
            {sheet.reviewedAt && <div className="text-xs text-muted-foreground mt-1">{new Date(sheet.reviewedAt).toLocaleString()}</div>}
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Approved By</div>
            <StaffIdentity fullName={sheet.approvedByName ?? '—'} staffId={sheet.approvedByStaffId} />
            {sheet.approvedAt && <div className="text-xs text-muted-foreground mt-1">{new Date(sheet.approvedAt).toLocaleString()}</div>}
          </div>
        </CardContent>
      </Card>

      {isStainQcSheetEditable(sheet.status) && canSubmitStainQcSheet(sheet, can) && (
        <Button disabled={saving} onClick={() => void onSubmit()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit for Review'}
        </Button>
      )}

      {canReviewStainQcSheet(sheet, userId, can) && (
        <Button disabled={saving} onClick={() => void onReview()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mark Reviewed'}
        </Button>
      )}

      {canApproveStainQcSheet(sheet, can) && (
        <Button disabled={saving} onClick={() => void onApprove()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
        </Button>
      )}
    </div>
  );
}
