-- ============================================================================
-- Hematology Section Portal
-- Migration 025: Extended Settings Keys
-- Adds extended portal settings stored in system_settings JSON.
-- ============================================================================

INSERT INTO public.system_settings (setting_key, setting_value, is_public, description) VALUES
  ('extended_portal', '{"hospitalName":"","hospitalAddress":"","departmentPhone":"","departmentEmail":"","primaryColor":"#5B2C8E","secondaryColor":"#7B3FA0","accentColor":"#9B59B6","backupEnabled":false,"backupFrequency":"weekly","auditRetentionDays":365,"documentRetentionDays":2555,"emailTemplates":[]}'::JSONB, FALSE, 'Extended portal and retention settings')
ON CONFLICT (setting_key) DO NOTHING;
