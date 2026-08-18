-- ============================================================================
-- Hematology Section Portal
-- Migration 017: Announcements
-- Production-safe. No seed data.
-- ============================================================================

CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'archived')),
  announcement_type TEXT NOT NULL DEFAULT 'news'
    CHECK (announcement_type IN ('news', 'circular', 'alert', 'emergency', 'event')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  target_audience TEXT NOT NULL DEFAULT 'all'
    CHECK (target_audience IN ('all', 'supervisors', 'technologists', 'quality', 'management')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_announcements_status ON public.announcements(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON public.announcements(is_pinned) WHERE deleted_at IS NULL AND is_pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_announcements_ends_at ON public.announcements(ends_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_announcements_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY announcements_select ON public.announcements
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.has_permission('announcements.view')
    AND (
      status = 'published'
      OR public.has_permission('announcements.manage')
    )
  );

CREATE POLICY announcements_insert ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('announcements.manage'));

CREATE POLICY announcements_update ON public.announcements
  FOR UPDATE TO authenticated
  USING (public.has_permission('announcements.manage') AND deleted_at IS NULL)
  WITH CHECK (public.has_permission('announcements.manage'));

CREATE POLICY announcements_delete ON public.announcements
  FOR DELETE TO authenticated
  USING (public.has_permission('announcements.manage'));
