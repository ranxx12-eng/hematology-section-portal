-- Critical Values module field update
-- Replaces legacy clinical notification fields with the new form structure.

ALTER TABLE public.critical_values
  ADD COLUMN IF NOT EXISTS record_date DATE,
  ADD COLUMN IF NOT EXISTS patient_name TEXT,
  ADD COLUMN IF NOT EXISTS patient_acc_number TEXT,
  ADD COLUMN IF NOT EXISTS critical_value TEXT,
  ADD COLUMN IF NOT EXISTS informed_to_dr TEXT,
  ADD COLUMN IF NOT EXISTS dr_id TEXT,
  ADD COLUMN IF NOT EXISTS verify_time TIME,
  ADD COLUMN IF NOT EXISTS informed_time TIME,
  ADD COLUMN IF NOT EXISTS comment TEXT,
  ADD COLUMN IF NOT EXISTS initial TEXT;

-- Migrate existing rows where possible
UPDATE public.critical_values
SET
  record_date = COALESCE(record_date, recorded_at::date),
  critical_value = COALESCE(critical_value, result_value),
  informed_to_dr = COALESCE(informed_to_dr, physician_contacted),
  comment = COALESCE(comment, notes),
  initial = COALESCE(initial, 'Legacy Import')
WHERE deleted_at IS NULL;

UPDATE public.critical_values
SET
  patient_name = COALESCE(patient_name, 'Unknown'),
  patient_acc_number = COALESCE(patient_acc_number, 'N/A'),
  dr_id = COALESCE(dr_id, 'N/A'),
  verify_time = COALESCE(verify_time, recorded_at::time),
  informed_time = COALESCE(informed_time, COALESCE(contact_time, recorded_at)::time)
WHERE deleted_at IS NULL
  AND (patient_name IS NULL OR patient_acc_number IS NULL OR dr_id IS NULL OR verify_time IS NULL OR informed_time IS NULL);

ALTER TABLE public.critical_values
  ALTER COLUMN record_date SET NOT NULL,
  ALTER COLUMN patient_name SET NOT NULL,
  ALTER COLUMN patient_acc_number SET NOT NULL,
  ALTER COLUMN critical_value SET NOT NULL,
  ALTER COLUMN informed_to_dr SET NOT NULL,
  ALTER COLUMN dr_id SET NOT NULL,
  ALTER COLUMN verify_time SET NOT NULL,
  ALTER COLUMN informed_time SET NOT NULL,
  ALTER COLUMN initial SET NOT NULL;

ALTER TABLE public.critical_values
  DROP COLUMN IF EXISTS result_value,
  DROP COLUMN IF EXISTS unit,
  DROP COLUMN IF EXISTS critical_limit,
  DROP COLUMN IF EXISTS physician_contacted,
  DROP COLUMN IF EXISTS contact_time,
  DROP COLUMN IF EXISTS read_back_completed,
  DROP COLUMN IF EXISTS notification_status,
  DROP COLUMN IF EXISTS delay_reason,
  DROP COLUMN IF EXISTS notes;

CREATE INDEX IF NOT EXISTS idx_critical_values_record_date ON public.critical_values(record_date DESC);
CREATE INDEX IF NOT EXISTS idx_critical_values_department ON public.critical_values(department);
