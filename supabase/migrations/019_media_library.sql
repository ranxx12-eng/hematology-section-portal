-- ============================================================================
-- Hematology Section Portal
-- Migration 019: Media Library
-- Production-safe. Root folder reference row only.
-- ============================================================================

CREATE TABLE public.media_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.media_folders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  folder_id UUID REFERENCES public.media_folders(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'other'
    CHECK (file_type IN ('image', 'video', 'pdf', 'word', 'excel', 'powerpoint', 'zip', 'other')),
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  tags JSONB NOT NULL DEFAULT '[]'::JSONB,
  category TEXT NOT NULL DEFAULT 'General',
  description TEXT,
  usage_count INTEGER NOT NULL DEFAULT 0,
  usage_locations JSONB NOT NULL DEFAULT '[]'::JSONB,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_media_assets_folder_id ON public.media_assets(folder_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_assets_category ON public.media_assets(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_folders_parent_id ON public.media_folders(parent_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_media_assets_updated_at BEFORE UPDATE ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.media_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY media_folders_select ON public.media_folders
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('media.view'));

CREATE POLICY media_folders_manage ON public.media_folders
  FOR ALL TO authenticated
  USING (public.has_permission('media.manage') AND deleted_at IS NULL)
  WITH CHECK (public.has_permission('media.manage'));

CREATE POLICY media_assets_select ON public.media_assets
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('media.view'));

CREATE POLICY media_assets_insert ON public.media_assets
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('media.manage'));

CREATE POLICY media_assets_update ON public.media_assets
  FOR UPDATE TO authenticated
  USING (public.has_permission('media.manage') AND deleted_at IS NULL)
  WITH CHECK (public.has_permission('media.manage'));

CREATE POLICY media_assets_delete ON public.media_assets
  FOR DELETE TO authenticated
  USING (public.has_permission('media.manage'));

INSERT INTO public.media_folders (id, name)
VALUES ('00000000-0000-4000-8000-000000000001', 'Root')
ON CONFLICT (id) DO NOTHING;
