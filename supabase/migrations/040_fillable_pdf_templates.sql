-- ============================================================================
-- Migration 040: Fillable PDF templates, positioned fields, submissions
-- Reuses forms.* RBAC from migration 039. Private storage bucket.
-- ============================================================================

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fillable-forms',
  'fillable-forms',
  FALSE,
  20971520,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fillable_pdf_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  form_number TEXT,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  source_pdf_path TEXT NOT NULL,
  source_pdf_name TEXT,
  page_count INTEGER NOT NULL DEFAULT 1,
  page_width_pt NUMERIC,
  page_height_pt NUMERIC,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.fillable_pdf_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.fillable_pdf_templates(id) ON DELETE CASCADE,
  field_order INTEGER NOT NULL DEFAULT 0,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  page_number INTEGER NOT NULL DEFAULT 1 CHECK (page_number >= 1),
  pos_x NUMERIC NOT NULL CHECK (pos_x >= 0 AND pos_x <= 1),
  pos_y NUMERIC NOT NULL CHECK (pos_y >= 0 AND pos_y <= 1),
  width NUMERIC NOT NULL CHECK (width > 0 AND width <= 1),
  height NUMERIC NOT NULL CHECK (height > 0 AND height <= 1),
  required BOOLEAN NOT NULL DEFAULT FALSE,
  placeholder TEXT,
  options JSONB,
  config JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT fillable_pdf_fields_pos_bounds CHECK (pos_x + width <= 1.001 AND pos_y + height <= 1.001)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fillable_pdf_fields_template_key
  ON public.fillable_pdf_fields(template_id, field_key)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.fillable_pdf_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.fillable_pdf_templates(id) ON DELETE RESTRICT,
  template_version INTEGER NOT NULL,
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_by_name TEXT,
  submitted_by_staff_id TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::JSONB,
  template_snapshot JSONB NOT NULL,
  completed_pdf_path TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fillable_pdf_templates_status
  ON public.fillable_pdf_templates(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fillable_pdf_fields_template
  ON public.fillable_pdf_fields(template_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fillable_pdf_submissions_template
  ON public.fillable_pdf_submissions(template_id, submitted_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_fillable_pdf_templates_updated_at
  BEFORE UPDATE ON public.fillable_pdf_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS (mirrors dynamic_forms / migration 039)
-- ---------------------------------------------------------------------------

ALTER TABLE public.fillable_pdf_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fillable_pdf_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fillable_pdf_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fillable_pdf_templates_select ON public.fillable_pdf_templates;
DROP POLICY IF EXISTS fillable_pdf_templates_insert ON public.fillable_pdf_templates;
DROP POLICY IF EXISTS fillable_pdf_templates_update ON public.fillable_pdf_templates;
DROP POLICY IF EXISTS fillable_pdf_templates_delete ON public.fillable_pdf_templates;

CREATE POLICY fillable_pdf_templates_select ON public.fillable_pdf_templates
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.can_access_form_design()
      OR public.can_manage_form_responses()
      OR (
        (public.has_permission('forms.view') OR public.can_submit_forms())
        AND public.is_published_form(status, is_published)
      )
    )
  );

CREATE POLICY fillable_pdf_templates_insert ON public.fillable_pdf_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_form_design());

CREATE POLICY fillable_pdf_templates_update ON public.fillable_pdf_templates
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.can_access_form_design()
      OR public.has_permission('forms.publish')
      OR public.has_permission('forms.manage')
    )
  )
  WITH CHECK (
    public.can_access_form_design()
    OR public.has_permission('forms.publish')
    OR public.has_permission('forms.manage')
  );

CREATE POLICY fillable_pdf_templates_delete ON public.fillable_pdf_templates
  FOR DELETE TO authenticated
  USING (
    public.can_access_form_design()
    OR public.has_permission('forms.publish')
    OR public.has_permission('forms.manage')
  );

DROP POLICY IF EXISTS fillable_pdf_fields_select ON public.fillable_pdf_fields;
DROP POLICY IF EXISTS fillable_pdf_fields_manage ON public.fillable_pdf_fields;

CREATE POLICY fillable_pdf_fields_select ON public.fillable_pdf_fields
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.fillable_pdf_templates t
      WHERE t.id = template_id AND t.deleted_at IS NULL
        AND (
          public.can_access_form_design()
          OR public.can_manage_form_responses()
          OR (
            (public.has_permission('forms.view') OR public.can_submit_forms())
            AND public.is_published_form(t.status, t.is_published)
          )
        )
    )
  );

CREATE POLICY fillable_pdf_fields_manage ON public.fillable_pdf_fields
  FOR ALL TO authenticated
  USING (public.can_access_form_design() AND deleted_at IS NULL)
  WITH CHECK (public.can_access_form_design());

DROP POLICY IF EXISTS fillable_pdf_submissions_select ON public.fillable_pdf_submissions;
DROP POLICY IF EXISTS fillable_pdf_submissions_insert ON public.fillable_pdf_submissions;
DROP POLICY IF EXISTS fillable_pdf_submissions_manage ON public.fillable_pdf_submissions;

CREATE POLICY fillable_pdf_submissions_select ON public.fillable_pdf_submissions
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.can_manage_form_responses());

CREATE POLICY fillable_pdf_submissions_insert ON public.fillable_pdf_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_submit_forms()
    AND EXISTS (
      SELECT 1 FROM public.fillable_pdf_templates t
      WHERE t.id = template_id AND t.deleted_at IS NULL
        AND public.is_published_form(t.status, t.is_published)
    )
  );

CREATE POLICY fillable_pdf_submissions_manage ON public.fillable_pdf_submissions
  FOR ALL TO authenticated
  USING (public.can_manage_form_responses() AND deleted_at IS NULL)
  WITH CHECK (public.can_manage_form_responses());

-- ---------------------------------------------------------------------------
-- Storage policies — fillable-forms bucket
-- ---------------------------------------------------------------------------

CREATE POLICY storage_fillable_forms_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fillable-forms'
    AND public.is_valid_storage_path(name)
    AND (
      public.can_access_form_design()
      OR public.can_manage_form_responses()
      OR public.has_permission('forms.view')
      OR public.can_submit_forms()
    )
  );

CREATE POLICY storage_fillable_forms_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fillable-forms'
    AND public.is_valid_storage_path(name)
    AND (
      public.can_access_form_design()
      OR public.can_submit_forms()
    )
  );

CREATE POLICY storage_fillable_forms_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fillable-forms'
    AND public.can_access_form_design()
  )
  WITH CHECK (
    bucket_id = 'fillable-forms'
    AND public.is_valid_storage_path(name)
    AND public.can_access_form_design()
  );

CREATE POLICY storage_fillable_forms_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'fillable-forms'
    AND public.can_access_form_design()
  );

-- ---------------------------------------------------------------------------
-- Seed: Form-Hema-001 Routine Tests Form (field positions from PDF text map)
-- ---------------------------------------------------------------------------

INSERT INTO public.fillable_pdf_templates (
  id,
  title,
  form_number,
  description,
  version,
  status,
  source_pdf_path,
  source_pdf_name,
  page_count,
  page_width_pt,
  page_height_pt,
  is_published
) VALUES (
  'a1000000-0000-4000-8000-000000000001',
  'Routine Tests Form',
  'Form-Hema-001',
  'Hematology Section routine tests manual form with PDF overlay fields.',
  1,
  'draft',
  'templates/Form-Hema-001-Routine-Tests-Form.pdf',
  'Form-Hema-001-Routine-Tests-Form.pdf',
  1,
  612,
  790.95,
  FALSE
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  form_number = EXCLUDED.form_number,
  description = EXCLUDED.description,
  source_pdf_path = EXCLUDED.source_pdf_path,
  source_pdf_name = EXCLUDED.source_pdf_name,
  page_width_pt = EXCLUDED.page_width_pt,
  page_height_pt = EXCLUDED.page_height_pt;

-- Re-seed field positions idempotently when re-running locally
DELETE FROM public.fillable_pdf_fields
WHERE template_id = 'a1000000-0000-4000-8000-000000000001';

INSERT INTO public.fillable_pdf_fields (
  template_id, field_order, field_key, label, field_type,
  page_number, pos_x, pos_y, width, height, required, config
) VALUES
  ('a1000000-0000-4000-8000-000000000001', 0, 'patient_name', 'Patient Name', 'text', 1, 0.188, 0.164, 0.286, 0.020, TRUE, '{"fontSize":9}'),
  ('a1000000-0000-4000-8000-000000000001', 1, 'clinic', 'Clinic', 'text', 1, 0.580, 0.164, 0.359, 0.020, FALSE, '{"fontSize":9}'),
  ('a1000000-0000-4000-8000-000000000001', 2, 'gender_age', 'Gender / Age', 'text', 1, 0.237, 0.186, 0.212, 0.020, FALSE, '{"fontSize":9}'),
  ('a1000000-0000-4000-8000-000000000001', 3, 'ref_by', 'Ref. By', 'text', 1, 0.580, 0.186, 0.359, 0.020, FALSE, '{"fontSize":9}'),
  ('a1000000-0000-4000-8000-000000000001', 4, 'patient_id', 'Patient ID', 'text', 1, 0.237, 0.206, 0.212, 0.020, TRUE, '{"fontSize":9}'),
  ('a1000000-0000-4000-8000-000000000001', 5, 'received_on', 'Received On', 'date', 1, 0.629, 0.206, 0.294, 0.020, FALSE, '{"fontSize":9}'),
  ('a1000000-0000-4000-8000-000000000001', 6, 'esr_result', 'ESR Result', 'text', 1, 0.253, 0.266, 0.106, 0.020, FALSE, '{"fontSize":9}'),
  ('a1000000-0000-4000-8000-000000000001', 7, 'esr_remarks', 'ESR Remarks', 'text', 1, 0.792, 0.266, 0.172, 0.020, FALSE, '{"fontSize":8}'),
  ('a1000000-0000-4000-8000-000000000001', 8, 'malaria_result', 'Malaria Result', 'text', 1, 0.253, 0.297, 0.106, 0.020, FALSE, '{"fontSize":9}'),
  ('a1000000-0000-4000-8000-000000000001', 9, 'malaria_remarks', 'Malaria Remarks', 'text', 1, 0.792, 0.297, 0.172, 0.020, FALSE, '{"fontSize":8}'),
  ('a1000000-0000-4000-8000-000000000001', 10, 'sickle_result', 'Sickle Test Result', 'text', 1, 0.253, 0.326, 0.106, 0.020, FALSE, '{"fontSize":9}'),
  ('a1000000-0000-4000-8000-000000000001', 11, 'sickle_remarks', 'Sickle Test Remarks', 'text', 1, 0.792, 0.326, 0.172, 0.020, FALSE, '{"fontSize":8}'),
  ('a1000000-0000-4000-8000-000000000001', 12, 'pt_result', 'PT Result', 'text', 1, 0.253, 0.377, 0.106, 0.048, FALSE, '{"fontSize":9}'),
  ('a1000000-0000-4000-8000-000000000001', 13, 'pt_remarks', 'PT Remarks', 'text', 1, 0.792, 0.377, 0.172, 0.048, FALSE, '{"fontSize":8}'),
  ('a1000000-0000-4000-8000-000000000001', 14, 'inr_result', 'INR Result', 'text', 1, 0.253, 0.428, 0.106, 0.020, FALSE, '{"fontSize":9}'),
  ('a1000000-0000-4000-8000-000000000001', 15, 'inr_remarks', 'INR Remarks', 'text', 1, 0.792, 0.428, 0.172, 0.020, FALSE, '{"fontSize":8}'),
  ('a1000000-0000-4000-8000-000000000001', 16, 'ptt_result', 'PTT Result', 'text', 1, 0.253, 0.466, 0.106, 0.048, FALSE, '{"fontSize":9}'),
  ('a1000000-0000-4000-8000-000000000001', 17, 'ptt_remarks', 'PTT Remarks', 'text', 1, 0.792, 0.466, 0.172, 0.048, FALSE, '{"fontSize":8}'),
  ('a1000000-0000-4000-8000-000000000001', 18, 'ddimer_result', 'D-Dimer Result', 'text', 1, 0.253, 0.516, 0.106, 0.020, FALSE, '{"fontSize":9}'),
  ('a1000000-0000-4000-8000-000000000001', 19, 'ddimer_remarks', 'D-Dimer Remarks', 'text', 1, 0.792, 0.516, 0.172, 0.020, FALSE, '{"fontSize":8}'),
  ('a1000000-0000-4000-8000-000000000001', 20, 'fibrinogen_result', 'Fibrinogen Result', 'text', 1, 0.253, 0.550, 0.106, 0.020, FALSE, '{"fontSize":9}'),
  ('a1000000-0000-4000-8000-000000000001', 21, 'fibrinogen_remarks', 'Fibrinogen Remarks', 'text', 1, 0.792, 0.550, 0.172, 0.020, FALSE, '{"fontSize":8}'),
  ('a1000000-0000-4000-8000-000000000001', 22, 'blood_film', 'Blood Film', 'textarea', 1, 0.237, 0.592, 0.703, 0.082, FALSE, '{"fontSize":8,"multiline":true}'),
  ('a1000000-0000-4000-8000-000000000001', 23, 'body_fluid', 'Body Fluid', 'textarea', 1, 0.237, 0.678, 0.703, 0.101, FALSE, '{"fontSize":8,"multiline":true}'),
  ('a1000000-0000-4000-8000-000000000001', 24, 'technical_verification', 'Technical Verification', 'text', 1, 0.327, 0.782, 0.155, 0.020, FALSE, '{"fontSize":9}'),
  ('a1000000-0000-4000-8000-000000000001', 25, 'technical_verification_date', 'Technical Verification Date', 'auto_date', 1, 0.188, 0.807, 0.196, 0.020, FALSE, '{"fontSize":9}'),
  ('a1000000-0000-4000-8000-000000000001', 26, 'technical_verification_time', 'Technical Verification Time', 'auto_time', 1, 0.188, 0.830, 0.196, 0.020, FALSE, '{"fontSize":9}'),
  ('a1000000-0000-4000-8000-000000000001', 27, 'received_by', 'Received By', 'staff_identity', 1, 0.654, 0.782, 0.245, 0.020, FALSE, '{"fontSize":9,"autoFill":"staff_name"}'),
  ('a1000000-0000-4000-8000-000000000001', 28, 'received_by_date', 'Received By Date', 'auto_date', 1, 0.588, 0.807, 0.196, 0.020, FALSE, '{"fontSize":9,"autoFill":"received_by"}'),
  ('a1000000-0000-4000-8000-000000000001', 29, 'received_by_time', 'Received By Time', 'auto_time', 1, 0.588, 0.830, 0.196, 0.020, FALSE, '{"fontSize":9,"autoFill":"received_by"}');

COMMIT;
