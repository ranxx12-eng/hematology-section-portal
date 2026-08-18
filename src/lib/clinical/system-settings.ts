import { createClient } from '@/lib/supabase/client';
import type { SystemSettings } from '@/types';
import { runClinicalMutation } from './result';

const DEFAULT_SETTINGS: SystemSettings = {
  laboratoryName: 'Central Laboratory',
  sectionName: 'Hematology Section',
  defaultLanguage: 'en',
  timezone: 'Asia/Riyadh',
  dateFormat: 'DD/MM/YYYY',
  tatTargets: { stat: 60, routine: 240, dDimer: 90, er: 45, icu: 30 },
  evaluationWeights: { fte: 0.4, staff: 0.3, supervisor: 0.1, labManager: 0.1, labDirector: 0.1 },
  rejectedSampleRetentionDays: 3,
};

interface SettingsBundle {
  settings: SystemSettings;
  error: string | null;
}

export async function fetchSystemSettings(): Promise<SettingsBundle> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value, is_public');

    if (error) {
      return { settings: DEFAULT_SETTINGS, error: error.message };
    }

    const byKey = Object.fromEntries((data ?? []).map((row) => [row.setting_key, row.setting_value]));
    const laboratory = (byKey.laboratory ?? {}) as Record<string, string>;
    const tatTargets = (byKey.tat_targets ?? DEFAULT_SETTINGS.tatTargets) as SystemSettings['tatTargets'];
    const evaluationWeights = (byKey.evaluation_weights ?? DEFAULT_SETTINGS.evaluationWeights) as SystemSettings['evaluationWeights'];
    const sampleRejection = (byKey.sample_rejection ?? {}) as { retentionDays?: number };

    return {
      settings: {
        laboratoryName: laboratory.laboratoryName ?? DEFAULT_SETTINGS.laboratoryName,
        sectionName: laboratory.sectionName ?? DEFAULT_SETTINGS.sectionName,
        defaultLanguage: (laboratory.defaultLanguage as SystemSettings['defaultLanguage']) ?? DEFAULT_SETTINGS.defaultLanguage,
        timezone: laboratory.timezone ?? DEFAULT_SETTINGS.timezone,
        dateFormat: laboratory.dateFormat ?? DEFAULT_SETTINGS.dateFormat,
        tatTargets,
        evaluationWeights,
        rejectedSampleRetentionDays: sampleRejection.retentionDays ?? DEFAULT_SETTINGS.rejectedSampleRetentionDays,
      },
      error: null,
    };
  } catch (err) {
    return {
      settings: DEFAULT_SETTINGS,
      error: err instanceof Error ? err.message : 'Failed to load settings',
    };
  }
}

export async function saveSystemSettings(settings: SystemSettings): Promise<{ error: string | null }> {
  const updates = [
    {
      setting_key: 'laboratory',
      setting_value: {
        laboratoryName: settings.laboratoryName,
        sectionName: settings.sectionName,
        defaultLanguage: settings.defaultLanguage,
        timezone: settings.timezone,
        dateFormat: settings.dateFormat,
      },
    },
    { setting_key: 'tat_targets', setting_value: settings.tatTargets },
    { setting_key: 'evaluation_weights', setting_value: settings.evaluationWeights },
    { setting_key: 'sample_rejection', setting_value: { retentionDays: settings.rejectedSampleRetentionDays } },
  ];

  try {
    const supabase = createClient();
    for (const row of updates) {
      const { error } = await supabase
        .from('system_settings')
        .update({ setting_value: row.setting_value })
        .eq('setting_key', row.setting_key);
      if (error) return { error: error.message };
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save settings' };
  }
}

export async function updateProfile(
  userId: string,
  updates: { fullName: string; language: 'en' | 'ar' },
): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to update profile', async () => {
    const supabase = createClient();
    return supabase
      .from('profiles')
      .update({ full_name: updates.fullName.trim(), language: updates.language })
      .eq('id', userId)
      .is('deleted_at', null)
      .select('id')
      .single();
  });
  return { error: result.error };
}
