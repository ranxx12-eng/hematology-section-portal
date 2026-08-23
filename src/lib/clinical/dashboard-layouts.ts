import { createClient } from '@/lib/supabase/client';
import type { DashboardLayoutInput } from '@/lib/dashboard/schema';
import {
  createDefaultDashboardWidgetLayout,
  normalizeDashboardWidgets,
  widgetTypesFromLayout,
} from '@/lib/dashboard/widget-registry';
import type { DashboardLayout, DashboardWidget, DashboardWidgetType } from '@/types/modules';
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
    widgets: normalizeDashboardWidgets(row.layout_config.widgets ?? []),
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
        data: {
          userId,
          widgets: createDefaultDashboardWidgetLayout(),
          updatedAt: new Date().toISOString(),
        },
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

export async function resolveDashboardWidgetTypes(userId: string): Promise<DashboardWidgetType[]> {
  const result = await fetchDashboardLayout(userId);
  if (result.error || !result.data) {
    return widgetTypesFromLayout(createDefaultDashboardWidgetLayout());
  }
  return widgetTypesFromLayout(result.data.widgets);
}

export async function saveDashboardLayout(
  userId: string,
  input: DashboardLayoutInput,
): Promise<ClinicalResult<DashboardLayout>> {
  const widgets = normalizeDashboardWidgets(input.widgets);

  return runClinicalMutation('Failed to save dashboard layout', async () => {
    const supabase = createClient();
    return supabase
      .from('dashboard_layouts')
      .upsert(
        {
          user_id: userId,
          layout_config: { widgets },
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
