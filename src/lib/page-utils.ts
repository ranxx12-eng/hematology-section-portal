import type { BadgeProps } from '@/components/ui/badge';

export function maskPatientId(id: string): string {
  if (id.length <= 6) return '******';
  return `${id.slice(0, 4)}****${id.slice(-2)}`;
}

export function statusBadgeVariant(status: string): BadgeProps['variant'] {
  const map: Record<string, BadgeProps['variant']> = {
    active: 'success',
    operational: 'success',
    available: 'success',
    accepted: 'success',
    pass: 'success',
    completed: 'success',
    closed: 'success',
    mitigated: 'success',
    notified: 'success',
    approved: 'success',
    within_target: 'success',
    recollected: 'success',

    warning: 'warning',
    partial: 'warning',
    pending_review: 'warning',
    in_progress: 'warning',
    near_breach: 'warning',
    delayed: 'warning',
    under_review: 'warning',
    low_stock: 'warning',
    on_leave: 'warning',

    fail: 'destructive',
    rejected: 'destructive',
    breached: 'destructive',
    overdue: 'destructive',
    critical: 'destructive',
    expired: 'destructive',
    depleted: 'destructive',
    out_of_service: 'destructive',
    decommissioned: 'destructive',
    cancelled: 'destructive',
    pending: 'secondary',
    open: 'secondary',
    not_started: 'secondary',
    draft: 'secondary',
    inactive: 'secondary',
    under_maintenance: 'secondary',
  };
  return map[status] ?? 'outline';
}

export function appendAuditLog(
  db: ReturnType<typeof import('@/lib/mock/store').getMockDatabase>,
  userId: string,
  action: string,
  module: string,
  recordId?: string
) {
  db.auditLogs.unshift({
    id: crypto.randomUUID(),
    userId,
    action,
    module,
    recordId,
    createdAt: new Date().toISOString(),
  });
}
