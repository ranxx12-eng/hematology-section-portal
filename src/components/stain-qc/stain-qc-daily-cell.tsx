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
import type { StainQcCellStatus } from '@/types/stain-qc';
import { cn } from '@/lib/utils';

interface StainQcDailyCellProps {
  status: StainQcCellStatus | null;
  readOnly?: boolean;
  ariaLabel: string;
  recordedByName?: string;
  recordedByInitials?: string;
  recordedAt?: string;
  correctiveComment?: string;
  onPrimaryClick?: () => void | Promise<void>;
  onSetStatus?: (status: StainQcCellStatus | null, amendmentReason?: string) => void | Promise<void>;
  onSaveCorrective?: (comment: string) => void | Promise<void>;
}

export function StainQcDailyCell({
  status,
  readOnly = false,
  ariaLabel,
  recordedByName,
  recordedByInitials,
  recordedAt,
  correctiveComment,
  onPrimaryClick,
  onSetStatus,
  onSaveCorrective,
}: StainQcDailyCellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [correctiveOpen, setCorrectiveOpen] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<StainQcCellStatus | null>(null);
  const [comment, setComment] = useState(correctiveComment ?? '');
  const [amendReason, setAmendReason] = useState('');

  const tooltip = [
    cellStatusAriaLabel(status),
    recordedByName ? `Recorded by ${recordedByName}` : null,
    recordedByInitials ? `Initials ${recordedByInitials}` : null,
    recordedAt ? new Date(recordedAt).toLocaleString() : null,
    correctiveComment ? `Corrective action: ${correctiveComment}` : null,
  ].filter(Boolean).join(' · ');

  async function applyStatus(next: StainQcCellStatus | null, reason?: string) {
    await onSetStatus?.(next, reason);
    if (next === 'not_acceptable') {
      setCorrectiveOpen(true);
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

      <Dialog open={correctiveOpen} onOpenChange={setCorrectiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Corrective action required</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="corrective-comment">Comment or corrective action</Label>
            <Textarea
              id="corrective-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              required
            />
          </div>
          <div className="flex justify-end">
            <Button
              disabled={!comment.trim()}
              onClick={() => {
                void onSaveCorrective?.(comment.trim());
                setCorrectiveOpen(false);
              }}
            >
              Save corrective action
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
