-- ============================================================================
-- Hematology Section Portal
-- Migration 020: Dynamic Forms
-- Production-safe. No seed data.
-- ============================================================================

CREATE TABLE public.dynamic_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.dynamic_forms(id) ON DELETE CASCADE,
  field_order INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL
    CHECK (field_type IN ('text', 'number', 'date', 'time', 'dropdown', 'radio', 'checkbox', 'file', 'signature', 'email', 'phone', 'multiselect')),
  required BOOLEAN NOT NULL DEFAULT FALSE,
  options JSONB,
  placeholder TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.dynamic_forms(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  answers JSONB NOT NULL DEFAULT '{}'::JSONB,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_form_fields_form_id ON public.form_fields(form_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id ON public.form_submissions(form_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_dynamic_forms_updated_at BEFORE UPDATE ON public.dynamic_forms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.dynamic_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY dynamic_forms_select ON public.dynamic_forms
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('forms.view'));

CREATE POLICY dynamic_forms_insert ON public.dynamic_forms
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('forms.manage'));

CREATE POLICY dynamic_forms_update ON public.dynamic_forms
  FOR UPDATE TO authenticated
  USING (public.has_permission('forms.manage') AND deleted_at IS NULL)
  WITH CHECK (public.has_permission('forms.manage'));

CREATE POLICY dynamic_forms_delete ON public.dynamic_forms
  FOR DELETE TO authenticated
  USING (public.has_permission('forms.manage'));

CREATE POLICY form_fields_select ON public.form_fields
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.has_permission('forms.view')
    AND EXISTS (
      SELECT 1 FROM public.dynamic_forms f
      WHERE f.id = form_id AND f.deleted_at IS NULL
    )
  );

CREATE POLICY form_fields_manage ON public.form_fields
  FOR ALL TO authenticated
  USING (public.has_permission('forms.manage') AND deleted_at IS NULL)
  WITH CHECK (public.has_permission('forms.manage'));

CREATE POLICY form_submissions_select ON public.form_submissions
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.has_permission('forms.view')
    AND EXISTS (
      SELECT 1 FROM public.dynamic_forms f
      WHERE f.id = form_id AND f.deleted_at IS NULL
    )
  );

CREATE POLICY form_submissions_insert ON public.form_submissions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('forms.view'));

CREATE POLICY form_submissions_manage ON public.form_submissions
  FOR ALL TO authenticated
  USING (public.has_permission('forms.manage') AND deleted_at IS NULL)
  WITH CHECK (public.has_permission('forms.manage'));
