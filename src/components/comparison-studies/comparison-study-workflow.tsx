'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StaffIdentity } from '@/components/shared/staff-identity';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MANUAL_REVIEW_DECISION_LABELS } from '@/lib/comparison-studies/constants';
import {
  canApproveComparisonStudies,
  canReviewComparisonStudies,
  canSubmitComparisonStudies,
  isComparisonStudyEditable,
} from '@/lib/comparison-studies/permissions';
import type { Permission } from '@/lib/permissions/roles';
import type { ComparisonManualReviewDecision, ComparisonStudy } from '@/types/comparison-study';

interface ComparisonStudyWorkflowProps {
  study: ComparisonStudy;
  can: (permission: Permission) => boolean;
  saving?: boolean;
  onSubmit: () => Promise<void>;
  onReview: (action: 'review' | 'return' | 'reject', comment?: string) => Promise<void>;
  onApprove: (action: 'approve' | 'return' | 'reject', comment?: string) => Promise<void>;
  onManualReview: (resultId: string, decision: ComparisonManualReviewDecision, comment: string) => Promise<void>;
}

export function ComparisonStudyWorkflow({
  study,
  can,
  saving,
  onSubmit,
  onReview,
  onApprove,
  onManualReview,
}: ComparisonStudyWorkflowProps) {
  const [comment, setComment] = useState('');
  const [manualResultId, setManualResultId] = useState('');
  const [manualDecision, setManualDecision] = useState<ComparisonManualReviewDecision | ''>('');
  const [manualComment, setManualComment] = useState('');

  const pendingManual = study.results.filter(
    (r) => r.resultStatus === 'manual_review' && !r.manualReviewDecision,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Signatures</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <div className="text-muted-foreground mb-1">Prepared By</div>
            <StaffIdentity fullName={study.preparedByName ?? ''} staffId={study.preparedByStaffId} />
            {study.preparedAt && <div className="text-xs text-muted-foreground mt-1">{new Date(study.preparedAt).toLocaleString()}</div>}
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Reviewed By</div>
            <StaffIdentity fullName={study.reviewedByName ?? ''} staffId={study.reviewedByStaffId} />
            {study.reviewedAt && <div className="text-xs text-muted-foreground mt-1">{new Date(study.reviewedAt).toLocaleString()}</div>}
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Approved By</div>
            <StaffIdentity fullName={study.approvedByName ?? ''} staffId={study.approvedByStaffId} />
            {study.approvedAt && <div className="text-xs text-muted-foreground mt-1">{new Date(study.approvedAt).toLocaleString()}</div>}
          </div>
        </CardContent>
      </Card>

      {pendingManual.length > 0 && canReviewComparisonStudies(can) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Manual Review Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Result</Label>
              <Select value={manualResultId} onValueChange={setManualResultId}>
                <SelectTrigger><SelectValue placeholder="Select result" /></SelectTrigger>
                <SelectContent>
                  {pendingManual.map((result) => (
                    <SelectItem key={result.id} value={result.id}>
                      {result.testName} — sample pending review
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Decision</Label>
              <Select value={manualDecision} onValueChange={(v) => setManualDecision(v as ComparisonManualReviewDecision)}>
                <SelectTrigger><SelectValue placeholder="Select decision" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MANUAL_REVIEW_DECISION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Comment (required)</Label>
              <Textarea value={manualComment} onChange={(e) => setManualComment(e.target.value)} rows={2} />
            </div>
            <Button
              disabled={saving || !manualResultId || !manualDecision || !manualComment.trim()}
              onClick={() => void onManualReview(manualResultId, manualDecision as ComparisonManualReviewDecision, manualComment)}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Complete Manual Review'}
            </Button>
          </CardContent>
        </Card>
      )}

      {(isComparisonStudyEditable(study) && canSubmitComparisonStudies(can)) && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={saving} onClick={() => void onSubmit()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit for Review'}
          </Button>
        </div>
      )}

      {study.status === 'pending_review' && canReviewComparisonStudies(can) && (
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

      {study.status === 'pending_approval' && canApproveComparisonStudies(can) && (
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
