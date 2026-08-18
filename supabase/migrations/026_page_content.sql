-- ============================================================================
-- Hematology Section Portal
-- Migration 026: Page Content CMS
-- Editable informational blocks per portal page (draft / published).
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.page_content_status AS ENUM ('draft', 'published');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.page_content_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT NOT NULL,
  block_type TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  body TEXT NOT NULL DEFAULT '',
  button_label TEXT,
  button_url TEXT,
  image_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
  image_url TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  status public.page_content_status NOT NULL DEFAULT 'draft',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT page_content_blocks_page_key_check CHECK (
    page_key IN ('dashboard', 'critical_values', 'sample_rejections', 'quality_control', 'maintenance')
  ),
  CONSTRAINT page_content_blocks_block_type_check CHECK (
    block_type IN ('page_meta', 'hero', 'text_block', 'image_block', 'quick_link', 'notice', 'banner', 'info_text')
  )
);

CREATE INDEX IF NOT EXISTS idx_page_content_blocks_page_key
  ON public.page_content_blocks(page_key, sort_order)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_page_content_blocks_status
  ON public.page_content_blocks(page_key, status)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_page_content_blocks_updated_at
  BEFORE UPDATE ON public.page_content_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.page_content_blocks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_page_content()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission('cms.manage')
    OR public.has_permission('settings.manage')
    OR public.has_permission('media.manage');
$$;

REVOKE ALL ON FUNCTION public.can_manage_page_content() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_page_content() TO authenticated;

CREATE POLICY page_content_blocks_select_published ON public.page_content_blocks
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND status = 'published'
    AND is_visible = TRUE
  );

CREATE POLICY page_content_blocks_select_manage ON public.page_content_blocks
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.can_manage_page_content());

CREATE POLICY page_content_blocks_insert ON public.page_content_blocks
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_page_content());

CREATE POLICY page_content_blocks_update ON public.page_content_blocks
  FOR UPDATE TO authenticated
  USING (public.can_manage_page_content() AND deleted_at IS NULL)
  WITH CHECK (public.can_manage_page_content());

CREATE POLICY page_content_blocks_delete ON public.page_content_blocks
  FOR DELETE TO authenticated
  USING (public.can_manage_page_content());

-- ---------------------------------------------------------------------------
-- Permissions: cms.view (read UI) / cms.manage (edit)
-- Lab technologist gets cms.view only — NOT cms.manage
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (code, module, description) VALUES
  ('cms.view', 'cms', 'View published page content'),
  ('cms.manage', 'cms', 'Manage page content blocks')
ON CONFLICT (code) DO UPDATE SET
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.code = 'cms.view'
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r
JOIN public.permissions p ON p.code = 'cms.manage'
WHERE r.name IN ('system_admin', 'lab_manager', 'head_of_section', 'quality_officer', 'education_coordinator')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Storage: CMS paths readable by all authenticated; writes require CMS manage
-- ---------------------------------------------------------------------------
CREATE POLICY storage_portal_media_cms_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'portal-media'
    AND public.is_valid_storage_path(name)
    AND name LIKE 'cms/%'
  );

CREATE POLICY storage_portal_media_cms_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'portal-media'
    AND public.is_valid_storage_path(name)
    AND name LIKE 'cms/%'
    AND public.can_manage_page_content()
  );

CREATE POLICY storage_portal_media_cms_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'portal-media' AND name LIKE 'cms/%' AND public.can_manage_page_content())
  WITH CHECK (bucket_id = 'portal-media' AND name LIKE 'cms/%' AND public.can_manage_page_content());

CREATE POLICY storage_portal_media_cms_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'portal-media' AND name LIKE 'cms/%' AND public.can_manage_page_content());

-- CMS editors may register assets without full media.manage
CREATE POLICY media_assets_cms_insert ON public.media_assets
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_page_content());

-- ---------------------------------------------------------------------------
-- Seed default published blocks (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO public.page_content_blocks (
  id, page_key, block_type, title, subtitle, body, sort_order, is_visible, status, published_at
) VALUES
  ('00000000-0000-4000-8001-000000000001', 'dashboard', 'page_meta',
    'Central Laboratory', 'Hematology Section',
    'Welcome to the Hematology Section Portal.', 0, TRUE, 'published', NOW()),
  ('00000000-0000-4000-8001-000000000010', 'dashboard', 'hero',
    'Central Laboratory', 'Hematology Section', '', 1, TRUE, 'published', NOW()),
  ('00000000-0000-4000-8001-000000000011', 'dashboard', 'notice',
    'Notice', NULL,
    'Check announcements and calendar for section updates.', 2, TRUE, 'published', NOW()),
  ('00000000-0000-4000-8001-000000000020', 'critical_values', 'page_meta',
    'Critical Values', NULL,
    'Record and track critical value notifications. Patient IDs are masked by default.', 0, TRUE, 'published', NOW()),
  ('00000000-0000-4000-8001-000000000021', 'critical_values', 'info_text',
    'Instructions', NULL,
    'Ensure critical results are communicated to the responsible physician within established turnaround targets.', 1, TRUE, 'published', NOW()),
  ('00000000-0000-4000-8001-000000000030', 'sample_rejections', 'page_meta',
    'Sample Rejections', NULL,
    'Document rejected samples and track replacement sample status.', 0, TRUE, 'published', NOW()),
  ('00000000-0000-4000-8001-000000000031', 'sample_rejections', 'info_text',
    'Guidance', NULL,
    'Select the rejection reason and replacement status accurately for quality reporting.', 1, TRUE, 'published', NOW()),
  ('00000000-0000-4000-8001-000000000040', 'quality_control', 'page_meta',
    'Quality Control', NULL,
    'Monitor QC runs, review out-of-range results, and document corrective actions.', 0, TRUE, 'published', NOW()),
  ('00000000-0000-4000-8001-000000000041', 'quality_control', 'info_text',
    'QC Workflow', NULL,
    'Enter QC results promptly and escalate unresolved failures to the section supervisor.', 1, TRUE, 'published', NOW()),
  ('00000000-0000-4000-8001-000000000050', 'maintenance', 'page_meta',
    'Maintenance', NULL,
    'Log instrument maintenance activities and daily checks.', 0, TRUE, 'published', NOW()),
  ('00000000-0000-4000-8001-000000000051', 'maintenance', 'info_text',
    'Maintenance Notes', NULL,
    'Record maintenance type, result, and any follow-up actions required.', 1, TRUE, 'published', NOW())
ON CONFLICT (id) DO NOTHING;
