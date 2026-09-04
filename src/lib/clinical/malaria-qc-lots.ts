import { createClient } from '@/lib/supabase/client';
import { isMalariaControlledQcParameter } from '@/lib/qc-records/malaria-qc';

export interface MalariaQcLotOption {
  lotUsageId: string;
  inventoryItemId: string;
  itemName: string;
  lotNumber: string;
  expiryDate?: string;
  controlLevel?: string;
}

function isNotExpired(expiryDate?: string | null): boolean {
  if (!expiryDate) return true;
  const expiry = new Date(expiryDate);
  expiry.setHours(23, 59, 59, 999);
  return expiry >= new Date();
}

function matchesMalariaParameter(
  itemName: string,
  testParameter: string | null | undefined,
  qcParameter: string,
): boolean {
  const name = itemName.toLowerCase();
  const param = (testParameter ?? '').toLowerCase();
  const malaria = name.includes('malaria') || param.includes('malaria');
  if (!malaria) return false;
  if (qcParameter.includes('Positivia') || qcParameter.includes('External Control')) {
    return param.includes('positivia') || param.includes('external') || name.includes('external') || name.includes('positivia');
  }
  if (qcParameter.includes('Screening') || qcParameter.includes('Kit')) {
    return param.includes('screening') || param.includes('kit') || name.includes('kit') || name.includes('screening');
  }
  return true;
}

export async function fetchActiveMalariaQcLots(
  qcParameter: string,
): Promise<{ data: MalariaQcLotOption[]; error: string | null }> {
  if (!isMalariaControlledQcParameter(qcParameter)) {
    return { data: [], error: null };
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('inventory_lot_usage')
      .select(`
        id,
        inventory_item_id,
        item_name_snapshot,
        lot_number_snapshot,
        expiry_date,
        test_parameter,
        status
      `)
      .eq('status', 'active')
      .order('updated_at', { ascending: false });

    if (error) return { data: [], error: error.message };

    const lots = (data ?? [])
      .filter((row) => matchesMalariaParameter(
        row.item_name_snapshot as string,
        row.test_parameter as string | null,
        qcParameter,
      ))
      .filter((row) => isNotExpired(row.expiry_date as string | null))
      .map((row) => ({
        lotUsageId: row.id as string,
        inventoryItemId: row.inventory_item_id as string,
        itemName: row.item_name_snapshot as string,
        lotNumber: row.lot_number_snapshot as string,
        expiryDate: (row.expiry_date as string | null) ?? undefined,
        controlLevel: (row.test_parameter as string | null) ?? undefined,
      }));

    return { data: lots, error: null };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err.message : 'Failed to load Malaria QC lots',
    };
  }
}
