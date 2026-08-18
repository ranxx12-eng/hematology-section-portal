import { createClient } from '@/lib/supabase/client';
import type { DashboardLayoutInput } from '@/lib/dashboard/schema';
import type { DashboardLayout, DashboardWidget } from '@/types/modules';
import { runClinicalMutation, type ClinicalResult } from './result';

interface DashboardLayoutRow {
  id: string;
  user_id: string;
  layout_config: { widgets?: DashboardWidget[] };
  visibility_prefs: Record<string, unknown>;
  updated_at: string;
}

function mapDashboardLayout(row: DashboardLayoutRow): DashboardLayout {
  return {
    userId: row.user_id,
    widgets: row.layout_config.widgets ?? [],
    updatedAt: row.updated_at,
  };
}

export async function fetchDashboardLayout(userId: string): Promise<ClinicalResult<DashboardLayout>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('dashboard_layouts')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    if (!data) {
      return {
        data: { userId, widgets: [], updatedAt: new Date().toISOString() },
        error: null,
      };
    }
    return { data: mapDashboardLayout(data as DashboardLayoutRow), error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to load dashboard layout',
    };
  }
}

export async function saveDashboardLayout(
  userId: string,
  input: DashboardLayoutInput,
): Promise<ClinicalResult<DashboardLayout>> {
  return runClinicalMutation('Failed to save dashboard layout', async () => {
    const supabase = createClient();
    return supabase
      .from('dashboard_layouts')
      .upsert(
        {
          user_id: userId,
          layout_config: { widgets: input.widgets },
          visibility_prefs: {},
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single();
  }).then((result) => ({
    data: result.data ? mapDashboardLayout(result.data as unknown as DashboardLayoutRow) : null,
    error: result.error,
  }));
}

export async function fetchDefaultDashboardWidgets(): Promise<{ type: DashboardWidget['type']; enabled: boolean; sortOrder: number }[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'cms_dashboard_widgets')
      .maybeSingle();

    const widgets = (data?.setting_value as { type: DashboardWidget['type']; enabled: boolean; sortOrder: number }[] | undefined) ?? [];
    return widgets.filter((w) => w.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
  } catch {
    return [];
  }
}
