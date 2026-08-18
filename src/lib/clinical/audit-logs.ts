import { createClient } from '@/lib/supabase/client';
import type { AuditLog } from '@/types';
import { runClinicalListQuery, type ClinicalListResult } from './result';

interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  module: string;
  record_id: string | null;
  previous_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

function mapAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    userId: row.user_id ?? '',
    action: row.action,
    module: row.module,
    recordId: row.record_id ?? undefined,
    previousValue: row.previous_value ? JSON.stringify(row.previous_value) : undefined,
    newValue: row.new_value ? JSON.stringify(row.new_value) : undefined,
    ipAddress: row.ip_address ?? undefined,
    userAgent: row.user_agent ?? undefined,
    createdAt: row.created_at,
  };
}

export async function fetchAuditLogs(): Promise<ClinicalListResult<AuditLog>> {
  return runClinicalListQuery('Failed to load audit logs', async () => {
    const supabase = createClient();
    return supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
  }).then((result) => ({
    data: (result.data as unknown as AuditLogRow[]).map(mapAuditLog),
    error: result.error,
  }));
}
