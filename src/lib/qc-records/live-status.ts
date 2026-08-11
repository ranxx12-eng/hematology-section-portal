import { isUnresolvedOut } from '@/lib/qc-records/schema';
import type { QCLiveRecord } from '@/types';

export type QCLiveOverallStatus =
  | 'ATTENTION — UNRESOLVED OUT QC'
  | 'QC STATUS — IN'
  | 'NO QC RECORD AVAILABLE';

export interface QCLiveStatusInfo {
  status: QCLiveOverallStatus;
  variant: 'destructive' | 'success' | 'warning';
  lastQcRun: string | null;
  lastUpdated: string | null;
  unresolvedOut: number;
}

/** Derive overall QC status from the latest applicable records (no fabrication). */
export function computeLiveOverallStatus(records: QCLiveRecord[]): QCLiveStatusInfo {
  if (records.length === 0) {
    return {
      status: 'NO QC RECORD AVAILABLE',
      variant: 'warning',
      lastQcRun: null,
      lastUpdated: null,
      unresolvedOut: 0,
    };
  }

  const sorted = [...records].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );

  const lastQcRun = sorted[0]?.recordedAt ?? null;
  const lastUpdated = sorted.reduce<string | null>((latest, r) => {
    if (!latest || new Date(r.updatedAt) > new Date(latest)) return r.updatedAt;
    return latest;
  }, null);

  const unresolvedOut = records.filter((r) => isUnresolvedOut(r.qcStatus, r.resolutionStatus)).length;

  if (unresolvedOut > 0) {
    return {
      status: 'ATTENTION — UNRESOLVED OUT QC',
      variant: 'destructive',
      lastQcRun,
      lastUpdated,
      unresolvedOut,
    };
  }

  return {
    status: 'QC STATUS — IN',
    variant: 'success',
    lastQcRun,
    lastUpdated,
    unresolvedOut: 0,
  };
}
