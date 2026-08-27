-- Migration 043: Optional metadata columns for portal-created fillable PDF templates

BEGIN;

ALTER TABLE public.fillable_pdf_templates
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS effective_date DATE,
  ADD COLUMN IF NOT EXISTS review_date DATE;

COMMIT;
