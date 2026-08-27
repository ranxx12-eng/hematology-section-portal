-- ============================================================================
-- Migration 038: Form Builder professional metadata, field config, submissions
-- Extends migration 020. Backward compatible. Idempotent where practical.
-- ============================================================================

BEGIN;

ALTER TABLE public.dynamic_forms
  ADD COLUMN IF NOT EXISTS form_number TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS effective_date DATE,
  ADD COLUMN IF NOT EXISTS review_date DATE,
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.dynamic_forms
  DROP CONSTRAINT IF EXISTS dynamic_forms_status_check;

ALTER TABLE public.dynamic_forms
  ADD CONSTRAINT dynamic_forms_status_check
  CHECK (status IN ('draft', 'published', 'archived'));

UPDATE public.dynamic_forms
SET status = CASE
  WHEN is_published THEN 'published'
  ELSE 'draft'
END
WHERE status = 'draft' AND is_published = TRUE;

UPDATE public.dynamic_forms
SET published_at = updated_at
WHERE status = 'published' AND published_at IS NULL;

UPDATE public.dynamic_forms
SET owner_id = created_by
WHERE owner_id IS NULL AND created_by IS NOT NULL;

ALTER TABLE public.form_fields
  ADD COLUMN IF NOT EXISTS field_key TEXT,
  ADD COLUMN IF NOT EXISTS help_text TEXT,
  ADD COLUMN IF NOT EXISTS default_value TEXT,
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE public.form_fields
  DROP CONSTRAINT IF EXISTS form_fields_field_type_check;

ALTER TABLE public.form_fields
  ADD CONSTRAINT form_fields_field_type_check
  CHECK (field_type IN (
    'text', 'textarea', 'number', 'date', 'time', 'datetime',
    'dropdown', 'radio', 'checkbox', 'yes_no', 'multiselect',
    'staff_selector', 'department_selector', 'instrument_selector', 'test_selector',
    'section_header', 'instructions', 'divider',
    'file', 'signature', 'repeating_table',
    'email', 'phone'
  ));

UPDATE public.form_fields
SET field_key = lower(regexp_replace(regexp_replace(label, '[^a-zA-Z0-9]+', '_', 'g'), '^_|_$', '', 'g'))
WHERE (field_key IS NULL OR btrim(field_key) = '')
  AND label IS NOT NULL;

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS submitted_by_name TEXT,
  ADD COLUMN IF NOT EXISTS submitted_by_staff_id TEXT,
  ADD COLUMN IF NOT EXISTS form_version INTEGER,
  ADD COLUMN IF NOT EXISTS form_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'submitted';

CREATE INDEX IF NOT EXISTS idx_dynamic_forms_status ON public.dynamic_forms(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dynamic_forms_form_number ON public.dynamic_forms(form_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at ON public.form_submissions(submitted_at DESC) WHERE deleted_at IS NULL;

COMMIT;
