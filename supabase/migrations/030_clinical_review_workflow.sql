-- ============================================================================
-- Hematology Section Portal
-- Migration 030: Critical Values & Sample Rejection review workflow
-- Adds review fields, supervisor manage permissions, and discard comment.
-- ============================================================================

-- Critical values supervisor review
ALTER TABLE public.critical_values
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'Pending Review',
  ADD COLUMN IF NOT EXISTS review_comment TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'critical_values_review_status_check'
      AND conrelid = 'public.critical_values'::regclass
  ) THEN
    ALTER TABLE public.critical_values
      ADD CONSTRAINT critical_values_review_status_check
      CHECK (review_status IN ('Pending Review', 'Reviewed', 'Needs Follow-up'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_critical_values_review_status
  ON public.critical_values(review_status)
  WHERE deleted_at IS NULL;

-- Sample rejection supervisor review comment and discard comment
ALTER TABLE public.sample_rejections
  ADD COLUMN IF NOT EXISTS supervisor_review_comment TEXT,
  ADD COLUMN IF NOT EXISTS discard_comment TEXT;

-- Grant supervisor roles manage permissions for review/update workflows (soft-delete aware)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'critical_values.manage',
  'sample_rejections.manage',
  'tat.view'
)
WHERE r.name IN ('section_supervisor', 'head_of_section')
ON CONFLICT (role_id, permission_id) DO UPDATE
  SET deleted_at = NULL
  WHERE public.role_permissions.deleted_at IS NOT NULL;
