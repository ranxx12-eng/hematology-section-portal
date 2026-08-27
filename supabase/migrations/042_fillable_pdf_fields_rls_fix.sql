-- ============================================================================
-- Migration 042: Fix fillable_pdf_fields RLS for designer save/upsert
--
-- Root cause: fillable_pdf_fields_manage (FOR ALL) required deleted_at IS NULL
-- in USING, blocking UPDATE/UPSERT restore after the app soft-deletes all fields
-- then upserts them back with deleted_at = NULL.
--
-- Does NOT disable RLS. Does NOT weaken routine-staff restrictions.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.can_design_fillable_pdf_template(p_template_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_template_id IS NOT NULL
    AND public.can_access_form_design()
    AND EXISTS (
      SELECT 1
      FROM public.fillable_pdf_templates t
      WHERE t.id = p_template_id
        AND t.deleted_at IS NULL
    );
$$;

REVOKE ALL ON FUNCTION public.can_design_fillable_pdf_template(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_design_fillable_pdf_template(UUID) TO authenticated;

DROP POLICY IF EXISTS fillable_pdf_fields_manage ON public.fillable_pdf_fields;

CREATE POLICY fillable_pdf_fields_insert ON public.fillable_pdf_fields
  FOR INSERT TO authenticated
  WITH CHECK (public.can_design_fillable_pdf_template(template_id));

CREATE POLICY fillable_pdf_fields_update ON public.fillable_pdf_fields
  FOR UPDATE TO authenticated
  USING (public.can_design_fillable_pdf_template(template_id))
  WITH CHECK (public.can_design_fillable_pdf_template(template_id));

CREATE POLICY fillable_pdf_fields_delete ON public.fillable_pdf_fields
  FOR DELETE TO authenticated
  USING (public.can_design_fillable_pdf_template(template_id));

COMMIT;
