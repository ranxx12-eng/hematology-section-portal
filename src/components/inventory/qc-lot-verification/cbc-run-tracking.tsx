'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { StatusChip } from '@/components/ui/status-chip';
import { buildRunProgress } from '@/lib/qc-lot-verification/cbc-calculation';
import type { QcLotVerificationRun } from '@/types/qc-lot-verification';

interface CbcRunTrackingProps {
  runs: QcLotVerificationRun[];
  editable: boolean;
  onToggle: (runId: string, completed: boolean) => void;
}

export function CbcRunTracking({ runs, editable, onToggle }: CbcRunTrackingProps) {
  const progress = buildRunProgress(runs);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-muted/20 p-4">
        <p className="text-sm font-medium">
          QC Verification Progress: {progress.completedRuns} / {progress.totalRuns} runs completed ({progress.percent}%)
        </p>
        <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress.percent}%` }} />
        </div>
        {progress.runsComplete && (
          <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-2">
            20 runs completed. Enter analyzer QC summary values to complete verification.
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {progress.dayProgress.map((day) => (
          <div key={day.dayNumber} className="rounded-2xl border p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-sm">Day {day.dayNumber}</p>
              <StatusChip
                variant={day.completed === day.total ? 'success' : 'neutral'}
                label={`${day.completed}/${day.total}${day.completed === day.total ? ' Complete' : ''}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {runs.filter((r) => r.dayNumber === day.dayNumber).map((run) => (
                <label key={run.id} className="flex items-start gap-2 rounded-lg border p-2 text-xs">
                  <Checkbox
                    checked={run.completed}
                    disabled={!editable}
                    onCheckedChange={(checked) => onToggle(run.id, checked === true)}
                  />
                  <span>
                    Run {run.runNumber}
                    {run.completed && run.completedAt && (
                      <span className="block text-muted-foreground mt-0.5">
                        {run.completedByName ?? 'User'} · {new Date(run.completedAt).toLocaleString()}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
