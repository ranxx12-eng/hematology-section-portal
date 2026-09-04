import { createClient } from '@/lib/supabase/client';
import { MANUAL_TEST_QC_SOURCE_NAME, resolveCanonicalQCInstrumentName } from '@/lib/qc-records/config';

/** Client-side sentinel for the virtual Manual Test QC source (not a physical instrument). */
export const MANUAL_TEST_VIRTUAL_QC_SOURCE_ID = 'virtual-qc-manual-test';

export function isVirtualQCInstrumentId(instrumentId: string): boolean {
  return instrumentId === MANUAL_TEST_VIRTUAL_QC_SOURCE_ID;
}

export function isManualTestQCSource(instrumentId: string, instrumentName?: string): boolean {
  return isVirtualQCInstrumentId(instrumentId)
    || instrumentName === MANUAL_TEST_QC_SOURCE_NAME;
}

/**
 * Resolve virtual QC source IDs to a persisted instruments.id for FK writes.
 * Only queries the database when a virtual source is selected (save-time, not page load).
 */
export async function resolveQCInstrumentIdForSave(
  instrumentId: string,
  instrumentName: string,
): Promise<{ id?: string; error?: string }> {
  if (!isVirtualQCInstrumentId(instrumentId)) {
    return { id: instrumentId };
  }

  if (instrumentName !== MANUAL_TEST_QC_SOURCE_NAME) {
    return { error: 'Unknown virtual QC source.' };
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('instruments')
      .select('id, name')
      .is('deleted_at', null)
      .in('name', [MANUAL_TEST_QC_SOURCE_NAME]);

    if (error) {
      return { error: error.message };
    }

    const match = (data ?? []).find(
      (row) => resolveCanonicalQCInstrumentName(String(row.name)) === MANUAL_TEST_QC_SOURCE_NAME,
    );

    if (!match) {
      return {
        error: 'Manual Test QC source is not linked in the database. Contact your administrator.',
      };
    }

    return { id: match.id as string };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to resolve Manual Test QC source',
    };
  }
}
