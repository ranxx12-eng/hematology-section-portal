import { createClient } from '@/lib/supabase/client';
import {
  MALARIA_QC_A_PARAMETER,
  MALARIA_QC_B_PARAMETER,
} from '@/lib/qc-records/malaria-qc';
import type { StaffContext } from './staff-context';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

export interface QCMaterialConfig {
  id: string;
  parameterName: string;
  lotNumber: string;
  expiryDate?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  updatedAt: string;
}

interface MaterialConfigRow {
  id: string;
  parameter_name: string;
  lot_number: string;
  expiry_date: string | null;
  effective_from: string | null;
  effective_to: string | null;
  updated_at: string;
}

function mapMaterialConfig(row: MaterialConfigRow): QCMaterialConfig {
  return {
    id: row.id,
    parameterName: row.parameter_name,
    lotNumber: row.lot_number,
    expiryDate: row.expiry_date ?? undefined,
    effectiveFrom: row.effective_from ?? undefined,
    effectiveTo: row.effective_to ?? undefined,
    updatedAt: row.updated_at,
  };
}

export const MALARIA_MATERIAL_PARAMETERS = [
  MALARIA_QC_A_PARAMETER,
  MALARIA_QC_B_PARAMETER,
] as const;

export async function fetchQCMaterialConfigs(): Promise<ClinicalListResult<QCMaterialConfig>> {
  const result = await runClinicalListQuery('Failed to load QC material configuration', async () => {
    const supabase = createClient();
    return supabase
      .from('qc_material_configs')
      .select('*')
      .in('parameter_name', [...MALARIA_MATERIAL_PARAMETERS])
      .order('parameter_name');
  });

  return {
    data: (result.data as MaterialConfigRow[]).map(mapMaterialConfig),
    error: result.error,
  };
}

export async function upsertQCMaterialConfig(
  staff: StaffContext,
  input: {
    parameterName: string;
    lotNumber: string;
    expiryDate?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
  },
): Promise<ClinicalResult<QCMaterialConfig>> {
  const payload = {
    parameter_name: input.parameterName,
    lot_number: input.lotNumber.trim(),
    expiry_date: input.expiryDate || null,
    effective_from: input.effectiveFrom || null,
    effective_to: input.effectiveTo || null,
    updated_by: staff.userId,
  };

  const result = await runClinicalMutation('Failed to save QC material configuration', async () => {
    const supabase = createClient();
    return supabase
      .from('qc_material_configs')
      .upsert(payload, { onConflict: 'parameter_name' })
      .select('*')
      .single();
  });

  if (!result.data) return { data: null, error: result.error };
  return { data: mapMaterialConfig(result.data as MaterialConfigRow), error: null };
}

export function materialConfigMapByParameter(
  configs: QCMaterialConfig[],
): Record<string, QCMaterialConfig> {
  return Object.fromEntries(configs.map((config) => [config.parameterName, config]));
}

export function materialConfigsToPrintLookup(
  configs: QCMaterialConfig[],
): Record<string, { lotNumber?: string; expiryDate?: string }> {
  return Object.fromEntries(
    configs.map((config) => [config.parameterName, {
      lotNumber: config.lotNumber || undefined,
      expiryDate: config.expiryDate,
    }]),
  );
}
