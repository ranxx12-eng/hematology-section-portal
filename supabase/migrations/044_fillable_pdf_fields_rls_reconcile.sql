-- ============================================================================
-- Migration 044: Idempotent fillable_pdf_fields RLS repair + upsert-safe policies
--
-- Ensures legacy fillable_pdf_fields_manage (FOR ALL, deleted_at IS NULL USING)
-- cannot block UPDATE/INSERT during designer save/publish reconciliation.
--
-- Safe to run after 042. Does NOT disable RLS or weaken routine-staff access.
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
DROP POLICY IF EXISTS fillable_pdf_fields_insert ON public.fillable_pdf_fields;
DROP POLICY IF EXISTS fillable_pdf_fields_update ON public.fillable_pdf_fields;
DROP POLICY IF EXISTS fillable_pdf_fields_delete ON public.fillable_pdf_fields;

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
