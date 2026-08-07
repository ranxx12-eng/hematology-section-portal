-- ============================================================================
-- Hematology Section Portal
-- Migration 007: CMS Schema
-- Production-safe. No seed data.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.leadership_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL,
  photo_url TEXT,
  biography TEXT NOT NULL DEFAULT '',
  qualifications TEXT NOT NULL DEFAULT '',
  years_of_experience INTEGER NOT NULL DEFAULT 0,
  email TEXT,
  phone_extension TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.content_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  cover_image_url TEXT,
  publication_date DATE NOT NULL,
  author TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT 'General',
  pdf_url TEXT,
  online_content TEXT NOT NULL DEFAULT '',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.dashboard_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_key TEXT NOT NULL UNIQUE,
  image_url TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_leadership_profiles_updated_at BEFORE UPDATE ON public.leadership_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_newsletters_updated_at BEFORE UPDATE ON public.newsletters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_dashboard_images_updated_at BEFORE UPDATE ON public.dashboard_images
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.leadership_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_images ENABLE ROW LEVEL SECURITY;

-- CMS read: any authenticated user; write: settings.manage or media.manage
CREATE POLICY leadership_profiles_select ON public.leadership_profiles
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY leadership_profiles_manage ON public.leadership_profiles
  FOR ALL TO authenticated
  USING (public.has_permission('settings.manage') OR public.has_permission('media.manage'))
  WITH CHECK (public.has_permission('settings.manage') OR public.has_permission('media.manage'));

CREATE POLICY content_sections_select ON public.content_sections
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY content_sections_manage ON public.content_sections
  FOR ALL TO authenticated
  USING (public.has_permission('settings.manage') OR public.has_permission('media.manage'))
  WITH CHECK (public.has_permission('settings.manage') OR public.has_permission('media.manage'));

CREATE POLICY newsletters_select ON public.newsletters
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

CREATE POLICY newsletters_manage ON public.newsletters
  FOR ALL TO authenticated
  USING (public.has_permission('settings.manage') OR public.has_permission('media.manage'))
  WITH CHECK (public.has_permission('settings.manage') OR public.has_permission('media.manage'));

CREATE POLICY dashboard_images_select ON public.dashboard_images
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY dashboard_images_manage ON public.dashboard_images
  FOR ALL TO authenticated
  USING (public.has_permission('settings.manage') OR public.has_permission('media.manage'))
  WITH CHECK (public.has_permission('settings.manage') OR public.has_permission('media.manage'));
