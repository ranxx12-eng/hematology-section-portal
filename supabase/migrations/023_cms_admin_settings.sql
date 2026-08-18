-- ============================================================================
-- Hematology Section Portal
-- Migration 023: CMS Admin Settings Keys
-- Seeds JSON setting keys for administration CMS state (non-sensitive defaults).
-- ============================================================================

INSERT INTO public.system_settings (setting_key, setting_value, is_public, description) VALUES
  ('cms_pages', '[]'::JSONB, FALSE, 'CMS page management configuration'),
  ('cms_navigation', '[]'::JSONB, FALSE, 'CMS navigation configuration'),
  ('cms_dashboard_widgets', '[]'::JSONB, TRUE, 'Default dashboard widget configuration'),
  ('cms_homepage', '{"heroTitle":"","heroSubtitle":"","showSpecialtyBadges":true,"specialtyBadges":[],"showPhotoGallery":true}'::JSONB, TRUE, 'Public homepage hero configuration'),
  ('cms_branding', '{"appTitle":"Hematology Section Portal","tagline":"","primaryColor":"#5B2C8E","secondaryColor":"#7B3FA0","accentColor":"#9B59B6"}'::JSONB, TRUE, 'Public portal branding configuration')
ON CONFLICT (setting_key) DO NOTHING;
