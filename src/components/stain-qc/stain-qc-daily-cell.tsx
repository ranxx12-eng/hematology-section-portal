'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cellStatusClass, cellStatusSymbol, cellStatusAriaLabel } from '@/lib/stain-qc/calendar';
import { STAIN_QC_CONTROLLED_CORRECTIVE_ACTION } from '@/lib/stain-qc/constants';
import type { StainQcCellStatus } from '@/types/stain-qc';
import { cn } from '@/lib/utils';

interface StainQcDailyCellProps {
  status: StainQcCellStatus | null;
  readOnly?: boolean;
  ariaLabel: string;
  recordedByName?: string;
  recordedByInitials?: string;
  recordedAt?: string;
  changeStainConfirmed?: boolean;
  optionalComment?: string;
  onPrimaryClick?: () => void | Promise<void>;
  onSetStatus?: (status: StainQcCellStatus | null, amendmentReason?: string) => void | Promise<void>;
  onConfirmChangeStain?: (optionalComment?: string) => void | Promise<void>;
}

export function StainQcDailyCell({
  status,
  readOnly = false,
  ariaLabel,
  recordedByName,
  recordedAt,
  changeStainConfirmed = false,
  optionalComment,
  onPrimaryClick,
  onSetStatus,
  onConfirmChangeStain,
}: StainQcDailyCellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [changeStainOpen, setChangeStainOpen] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<StainQcCellStatus | null>(null);
  const [comment, setComment] = useState(optionalComment ?? '');
  const [amendReason, setAmendReason] = useState('');

  const tooltip = [
    cellStatusAriaLabel(status),
    recordedByName ? `Recorded by ${recordedByName}` : null,
    recordedAt ? new Date(recordedAt).toLocaleString() : null,
    status === 'not_acceptable' && changeStainConfirmed ? `${STAIN_QC_CONTROLLED_CORRECTIVE_ACTION} confirmed` : null,
    status === 'not_acceptable' && !changeStainConfirmed ? `${STAIN_QC_CONTROLLED_CORRECTIVE_ACTION} required` : null,
    optionalComment ? `Comment: ${optionalComment}` : null,
  ].filter(Boolean).join(' · ');

  async function applyStatus(next: StainQcCellStatus | null, reason?: string) {
    await onSetStatus?.(next, reason);
    if (next === 'not_acceptable') {
      setChangeStainOpen(true);
    }
    setMenuOpen(false);
  }

  return (
    <>
      <div className="relative group min-h-10">
        <button
          type="button"
          className={cn(
            'w-full min-h-10 border rounded-sm text-sm flex items-center justify-center',
            cellStatusClass(status),
            !readOnly && 'cursor-pointer',
          )}
          aria-label={ariaLabel}
          title={tooltip}
          disabled={readOnly}
          onClick={() => {
            if (readOnly) return;
            if (status == null) {
              void onPrimaryClick?.();
            } else if (status === 'not_acceptable' && !changeStainConfirmed) {
              setChangeStainOpen(true);
            } else {
              setMenuOpen((open) => !open);
            }
          }}
        >
          <span aria-hidden="true">{cellStatusSymbol(status)}</span>
          <span className="sr-only">{cellStatusAriaLabel(status)}</span>
        </button>

        {!readOnly && menuOpen && (
          <div className="absolute z-30 top-full left-0 mt-1 min-w-[140px] rounded-md border bg-background p-1 shadow-md">
            <button type="button" className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted" onClick={() => void applyStatus('acceptable')}>✓ : ACCEPTABLE</button>
            <button type="button" className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted" onClick={() => void applyStatus('not_acceptable')}>✕ : NOT ACCEPTABLE</button>
            <button type="button" className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted" onClick={() => void applyStatus('na')}>N/A : NOT APPLICABLE</button>
            <button
              type="button"
              className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted"
              onClick={() => {
                if (status === 'not_acceptable') {
                  setPendingStatus(null);
                  setAmendOpen(true);
                  setMenuOpen(false);
                  return;
                }
                void applyStatus(null);
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <Dialog open={changeStainOpen} onOpenChange={setChangeStainOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm {STAIN_QC_CONTROLLED_CORRECTIVE_ACTION}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This Not Acceptable result must be corrected with the controlled action &quot;{STAIN_QC_CONTROLLED_CORRECTIVE_ACTION}&quot;.
            The ✕ result will remain recorded.
          </p>
          <div className="space-y-2">
            <Label htmlFor="change-stain-comment">Optional comment</Label>
            <Textarea
              id="change-stain-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Additional details (optional)"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setChangeStainOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                void onConfirmChangeStain?.(comment.trim() || undefined);
                setChangeStainOpen(false);
              }}
            >
              Confirm {STAIN_QC_CONTROLLED_CORRECTIVE_ACTION}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={amendOpen} onOpenChange={setAmendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reason required</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="amend-reason">Reason for changing Not Acceptable result</Label>
            <Input id="amend-reason" value={amendReason} onChange={(e) => setAmendReason(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button
              disabled={!amendReason.trim()}
              onClick={() => {
                void applyStatus(pendingStatus, amendReason.trim());
                setAmendOpen(false);
                setAmendReason('');
              }}
            >
              Confirm change
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
