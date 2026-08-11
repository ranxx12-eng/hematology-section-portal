-- ============================================================================
-- Hematology Section Portal
-- Migration 014: QC Live View — public read-only access via controlled view/RPC
-- Exposes only non-sensitive QC operational fields; qc_records RLS unchanged.
-- ============================================================================

-- Stable human-readable slugs for live QC URLs (not UUIDs)
ALTER TABLE public.instruments
  ADD COLUMN IF NOT EXISTS live_view_slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_instruments_live_view_slug
  ON public.instruments(live_view_slug)
  WHERE deleted_at IS NULL AND live_view_slug IS NOT NULL;

UPDATE public.instruments SET live_view_slug = 'alinity-hq-1147'
WHERE name = 'Alinity HQ 1147' AND deleted_at IS NULL AND live_view_slug IS NULL;

UPDATE public.instruments SET live_view_slug = 'alinity-hq-1149'
WHERE name = 'Alinity HQ 1149' AND deleted_at IS NULL AND live_view_slug IS NULL;

UPDATE public.instruments SET live_view_slug = 'stago-sta-r-max3'
WHERE name = 'Stago STA R MAX3' AND deleted_at IS NULL AND live_view_slug IS NULL;

UPDATE public.instruments SET live_view_slug = 'alifax-test1'
WHERE name = 'Alifax Test1' AND deleted_at IS NULL AND live_view_slug IS NULL;

UPDATE public.instruments SET live_view_slug = 'manual-test'
WHERE name = 'Manual Test' AND deleted_at IS NULL AND live_view_slug IS NULL;

-- Read-only view: ONLY non-sensitive QC fields (no PHI, no profile FKs, no user IDs)
CREATE OR REPLACE VIEW public.qc_live_view
WITH (security_invoker = false) AS
SELECT
  qr.id,
  qr.instrument_id,
  i.name AS instrument_name,
  i.live_view_slug,
  qr.test_name AS parameter,
  qr.control_level AS level,
  qr.qc_status,
  qr.corrective_actions,
  qr.corrective_action_comment,
  qr.resolution_status,
  qr.recorded_at,
  qr.performed_by_name,
  qr.resolved_at,
  qr.qc_batch_id,
  qr.updated_at
FROM public.qc_records qr
INNER JOIN public.instruments i ON i.id = qr.instrument_id
WHERE qr.deleted_at IS NULL
  AND i.deleted_at IS NULL
  AND i.live_view_slug IS NOT NULL;

GRANT SELECT ON public.qc_live_view TO anon, authenticated;

-- Instrument lookup by slug (public)
CREATE OR REPLACE FUNCTION public.get_qc_live_instrument(p_instrument_slug TEXT)
RETURNS TABLE (
  instrument_id UUID,
  instrument_name TEXT,
  live_view_slug TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.name, i.live_view_slug
  FROM public.instruments i
  WHERE i.live_view_slug = p_instrument_slug
    AND i.deleted_at IS NULL
  LIMIT 1;
$$;

-- Filtered QC records for live view (public, server-side filtering)
CREATE OR REPLACE FUNCTION public.get_qc_live_records(
  p_instrument_slug TEXT,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_parameter TEXT DEFAULT NULL,
  p_level TEXT DEFAULT NULL,
  p_qc_status TEXT DEFAULT NULL,
  p_resolution TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  instrument_id UUID,
  instrument_name TEXT,
  live_view_slug TEXT,
  parameter TEXT,
  level TEXT,
  qc_status public.qc_in_out,
  corrective_actions JSONB,
  corrective_action_comment TEXT,
  resolution_status public.qc_resolution_status,
  recorded_at TIMESTAMPTZ,
  performed_by_name TEXT,
  resolved_at TIMESTAMPTZ,
  qc_batch_id UUID,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.instrument_id,
    v.instrument_name,
    v.live_view_slug,
    v.parameter,
    v.level,
    v.qc_status,
    v.corrective_actions,
    v.corrective_action_comment,
    v.resolution_status,
    v.recorded_at,
    v.performed_by_name,
    v.resolved_at,
    v.qc_batch_id,
    v.updated_at
  FROM public.qc_live_view v
  WHERE v.live_view_slug = p_instrument_slug
    AND (p_date_from IS NULL OR v.recorded_at >= p_date_from)
    AND (p_date_to IS NULL OR v.recorded_at <= p_date_to)
    AND (p_parameter IS NULL OR p_parameter = '' OR v.parameter = p_parameter)
    AND (p_level IS NULL OR p_level = '' OR v.level = p_level)
    AND (p_qc_status IS NULL OR p_qc_status = '' OR v.qc_status::TEXT = p_qc_status)
    AND (
      p_resolution IS NULL OR p_resolution = '' OR p_resolution = 'all'
      OR (p_resolution = 'resolved' AND v.qc_status = 'OUT' AND v.resolution_status = 'IN')
      OR (p_resolution = 'unresolved' AND v.qc_status = 'OUT' AND (v.resolution_status IS NULL OR v.resolution_status <> 'IN'))
      OR (p_resolution = 'Pending' AND v.qc_status = 'OUT' AND v.resolution_status = 'Pending')
      OR (p_resolution = 'Still OUT' AND v.qc_status = 'OUT' AND v.resolution_status = 'Still OUT')
    )
  ORDER BY v.recorded_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_qc_live_instrument(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_qc_live_records(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_qc_live_instrument(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_qc_live_records(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Optional audit log for live view access
CREATE TABLE IF NOT EXISTS public.qc_live_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID REFERENCES public.instruments(id) ON DELETE SET NULL,
  live_view_slug TEXT NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  viewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.qc_live_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY qc_live_access_log_insert ON public.qc_live_access_log
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY qc_live_access_log_select ON public.qc_live_access_log
  FOR SELECT TO authenticated
  USING (public.has_permission('qc.manage') OR public.is_system_admin());
