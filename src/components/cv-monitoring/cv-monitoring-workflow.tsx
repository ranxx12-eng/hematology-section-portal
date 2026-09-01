'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { StaffIdentity } from '@/components/shared/staff-identity';
import type { Permission } from '@/lib/permissions/roles';
import {
  canApproveCvMonitoring,
  canReviewCvMonitoring,
  canSubmitCvMonitoring,
  isCvRecordEditable,
} from '@/lib/cv-monitoring/permissions';
import type { CvMonitoringRecord } from '@/types/cv-monitoring';

interface CvMonitoringWorkflowProps {
  record: CvMonitoringRecord;
  can: (permission: Permission) => boolean;
  saving?: boolean;
  onSubmit: () => Promise<void>;
  onReview: (action: 'review' | 'return' | 'reject', comment?: string) => Promise<void>;
  onApprove: (action: 'approve' | 'return' | 'reject', comment?: string) => Promise<void>;
}

export function CvMonitoringWorkflow({
  record,
  can,
  saving,
  onSubmit,
  onReview,
  onApprove,
}: CvMonitoringWorkflowProps) {
  const [comment, setComment] = useState('');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Signatures</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <div className="text-muted-foreground mb-1">Prepared By</div>
            <StaffIdentity fullName={record.preparedByName ?? ''} staffId={record.preparedByStaffId} />
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Reviewed By</div>
            <StaffIdentity fullName={record.reviewedByName ?? ''} staffId={record.reviewedByStaffId} />
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Approved By</div>
            <StaffIdentity fullName={record.approvedByName ?? ''} staffId={record.approvedByStaffId} />
          </div>
        </CardContent>
      </Card>

      {isCvRecordEditable(record) && canSubmitCvMonitoring(can) && (
        <Button disabled={saving} onClick={() => void onSubmit()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit for Review'}
        </Button>
      )}

      {record.status === 'pending_review' && canReviewCvMonitoring(can) && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Reviewer Actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea placeholder="Comment required for return/reject" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
            <div className="flex flex-wrap gap-2">
              <Button disabled={saving} onClick={() => void onReview('review')}>Review</Button>
              <Button variant="secondary" disabled={saving || !comment.trim()} onClick={() => void onReview('return', comment)}>Return</Button>
              <Button variant="destructive" disabled={saving || !comment.trim()} onClick={() => void onReview('reject', comment)}>Reject</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {record.status === 'pending_approval' && canApproveCvMonitoring(can) && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Approver Actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea placeholder="Comment required for return/reject" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
            <div className="flex flex-wrap gap-2">
              <Button disabled={saving} onClick={() => void onApprove('approve')}>Approve</Button>
              <Button variant="secondary" disabled={saving || !comment.trim()} onClick={() => void onApprove('return', comment)}>Return</Button>
              <Button variant="destructive" disabled={saving || !comment.trim()} onClick={() => void onApprove('reject', comment)}>Reject</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
