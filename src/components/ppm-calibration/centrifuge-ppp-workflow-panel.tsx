'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  centrifugePppApprovalSchema,
  centrifugePppReviewSchema,
  type CentrifugePppApprovalFormData,
  type CentrifugePppReviewFormData,
} from '@/lib/ppm-calibration/centrifuge-ppp-schema';
import type { CentrifugePppCalibration } from '@/types/centrifuge-ppp-calibration';

interface CentrifugePppWorkflowPanelProps {
  calibration: CentrifugePppCalibration;
  canReview: boolean;
  canApprove: boolean;
  onReview: (form: CentrifugePppReviewFormData) => Promise<void>;
  onApprove: (form: CentrifugePppApprovalFormData) => Promise<void>;
}

export function CentrifugePppWorkflowPanel({
  calibration,
  canReview,
  canApprove,
  onReview,
  onApprove,
}: CentrifugePppWorkflowPanelProps) {
  const [reviewForm, setReviewForm] = useState<CentrifugePppReviewFormData>({ reviewDecision: 'Reviewed' });
  const [approvalForm, setApprovalForm] = useState<CentrifugePppApprovalFormData>({ approvalDecision: 'Approved' });
  const [working, setWorking] = useState(false);

  const submitReview = async () => {
    const parsed = centrifugePppReviewSchema.safeParse(reviewForm);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid review form');
      return;
    }
    setWorking(true);
    await onReview(parsed.data);
    setWorking(false);
  };

  const submitApproval = async () => {
    const parsed = centrifugePppApprovalSchema.safeParse(approvalForm);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid approval form');
      return;
    }
    setWorking(true);
    await onApprove(parsed.data);
    setWorking(false);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-semibold">Review By — Senior Technologist</h3>
        <p className="text-sm text-muted-foreground">Status: {calibration.reviewStatus}</p>
        {calibration.reviewedByName && (
          <p className="text-sm">Reviewed by {calibration.reviewedByName} ({calibration.reviewedByStaffId ?? '—'}) on {calibration.reviewedAt?.slice(0, 10) ?? '—'}</p>
        )}
        {canReview && calibration.status === 'pending_review' && (
          <>
            <div>
              <Label>Decision</Label>
              <Select
                value={reviewForm.reviewDecision}
                onValueChange={(v) => setReviewForm((prev) => ({ ...prev, reviewDecision: v as CentrifugePppReviewFormData['reviewDecision'] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Reviewed">Reviewed</SelectItem>
                  <SelectItem value="Returned">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Comment</Label>
              <Textarea
                value={reviewForm.reviewComment ?? ''}
                onChange={(e) => setReviewForm((prev) => ({ ...prev, reviewComment: e.target.value }))}
                rows={2}
              />
            </div>
            <Button disabled={working} onClick={() => void submitReview()}>Submit Review</Button>
          </>
        )}
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-semibold">Approved By — Section Head</h3>
        <p className="text-sm text-muted-foreground">Status: {calibration.approvalStatus}</p>
        {calibration.approvedByName && (
          <p className="text-sm">Approved by {calibration.approvedByName} ({calibration.approvedByStaffId ?? '—'}) on {calibration.approvedAt?.slice(0, 10) ?? '—'}</p>
        )}
        {canApprove && calibration.status === 'pending_approval' && (
          <>
            <div>
              <Label>Decision</Label>
              <Select
                value={approvalForm.approvalDecision}
                onValueChange={(v) => setApprovalForm((prev) => ({ ...prev, approvalDecision: v as CentrifugePppApprovalFormData['approvalDecision'] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Returned">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Comment</Label>
              <Textarea
                value={approvalForm.approvalComment ?? ''}
                onChange={(e) => setApprovalForm((prev) => ({ ...prev, approvalComment: e.target.value }))}
                rows={2}
              />
            </div>
            <Button disabled={working} onClick={() => void submitApproval()}>Submit Approval</Button>
          </>
        )}
      </div>
    </div>
  );
}
