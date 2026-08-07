-- ============================================================================
-- DEVELOPMENT SEED ONLY — DO NOT RUN IN PRODUCTION
-- File: supabase/seeds/development_seed.sql
--
-- Loads demo employees, instruments, clinical records, tasks, etc.
-- Requires production migrations 001-010 to be applied first.
-- Run locally via: supabase db reset (with seed configured) or psql -f
-- ============================================================================

BEGIN;

-- Demo system auth user (local development only)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, recovery_sent_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'p0000001-0000-4000-8000-000000000001',
  'authenticated', 'authenticated',
  'system@hematology.local',
  crypt('ChangeMe123!', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}'::JSONB,
  '{"full_name":"System Seed User"}'::JSONB,
  NOW(), NOW(), '', '', '', ''
) ON CONFLICT (id) DO NOTHING;

-- EMPLOYEES (12 staff members)
-- ============================================================================

INSERT INTO public.employees (
  id, employee_code, full_name, email, phone, job_title, role, section,
  hire_date, employment_status, shift, supervisor_id, is_active
) VALUES
  ('e0000001-0000-4000-8000-000000000001', 'HEM-001', 'Abdullah', 'abdullah@hematology.local', '+966500000001', 'Laboratory Director', 'lab_director', 'Hematology', '2015-03-01', 'active', 'morning', NULL, TRUE),
  ('e0000001-0000-4000-8000-000000000002', 'HEM-002', 'Nahla', 'nahla@hematology.local', '+966500000002', 'Laboratory Manager', 'lab_manager', 'Hematology', '2016-06-15', 'active', 'morning', 'e0000001-0000-4000-8000-000000000001', TRUE),
  ('e0000001-0000-4000-8000-000000000003', 'HEM-003', 'Alhanouf', 'alhanouf@hematology.local', '+966500000003', 'Head of Hematology Section', 'head_of_section', 'Hematology', '2017-01-10', 'active', 'morning', 'e0000001-0000-4000-8000-000000000002', TRUE),
  ('e0000001-0000-4000-8000-000000000004', 'HEM-004', 'Rawan Alfaifi', 'rawan.alfaifi@hematology.local', '+966500000004', 'Section Supervisor', 'section_supervisor', 'Hematology', '2018-09-01', 'active', 'morning', 'e0000001-0000-4000-8000-000000000003', TRUE),
  ('e0000001-0000-4000-8000-000000000005', 'HEM-005', 'Ahmed', 'ahmed@hematology.local', '+966500000005', 'Quality Link Officer', 'quality_officer', 'Hematology', '2019-02-20', 'active', 'morning', 'e0000001-0000-4000-8000-000000000003', TRUE),
  ('e0000001-0000-4000-8000-000000000006', 'HEM-006', 'Renad', 'renad@hematology.local', '+966500000006', 'Senior Lab Technologist', 'senior_lab_technologist', 'Hematology', '2020-04-12', 'active', 'evening', 'e0000001-0000-4000-8000-000000000004', TRUE),
  ('e0000001-0000-4000-8000-000000000007', 'HEM-007', 'Hamzah', 'hamzah@hematology.local', '+966500000007', 'Senior Lab Technologist', 'senior_lab_technologist', 'Hematology', '2020-07-08', 'active', 'night', 'e0000001-0000-4000-8000-000000000004', TRUE),
  ('e0000001-0000-4000-8000-000000000008', 'HEM-008', 'Alanoud', 'alanoud@hematology.local', '+966500000008', 'Lab Technologist', 'lab_technologist', 'Hematology', '2021-11-03', 'active', 'morning', 'e0000001-0000-4000-8000-000000000004', TRUE),
  ('e0000001-0000-4000-8000-000000000009', 'HEM-009', 'Fatimah', 'fatimah@hematology.local', '+966500000009', 'Lab Technologist', 'lab_technologist', 'Hematology', '2022-01-18', 'active', 'evening', 'e0000001-0000-4000-8000-000000000004', TRUE),
  ('e0000001-0000-4000-8000-000000000010', 'HEM-010', 'Rawan Albalwi', 'rawan.albalwi@hematology.local', '+966500000010', 'Lab Technologist', 'lab_technologist', 'Hematology', '2022-05-22', 'active', 'morning', 'e0000001-0000-4000-8000-000000000004', TRUE),
  ('e0000001-0000-4000-8000-000000000011', 'HEM-011', 'Rawan Alheta', 'rawan.alheta@hematology.local', '+966500000011', 'Lab Technologist', 'lab_technologist', 'Hematology', '2023-03-14', 'active', 'evening', 'e0000001-0000-4000-8000-000000000004', TRUE),
  ('e0000001-0000-4000-8000-000000000012', 'HEM-012', 'Musa', 'musa@hematology.local', '+966500000012', 'Lab Technologist', 'lab_technologist', 'Hematology', '2023-08-07', 'active', 'night', 'e0000001-0000-4000-8000-000000000004', TRUE);

UPDATE public.profiles
SET
  full_name = 'System Seed User',
  primary_role_id = (SELECT id FROM public.roles WHERE name = 'system_admin' LIMIT 1),
  employee_id = 'e0000001-0000-4000-8000-000000000003'
WHERE id = 'p0000001-0000-4000-8000-000000000001';

INSERT INTO public.user_roles (user_id, role_id, assigned_by)
SELECT
  'p0000001-0000-4000-8000-000000000001',
  r.id,
  'p0000001-0000-4000-8000-000000000001'
FROM public.roles r
WHERE r.name = 'system_admin';

-- ============================================================================
-- INSTRUMENTS (3 analyzers)
-- ============================================================================

INSERT INTO public.instruments (
  id, name, manufacturer, model, serial_number, location, installation_date,
  status, last_maintenance, next_maintenance, calibration_due_date, service_provider
) VALUES
  ('i0000001-0000-4000-8000-000000000001', 'Abbott Alinity HQ', 'Abbott', 'Alinity hq', 'ALN-HQ-2021-0042', 'Hematology Lab - Bench 1', '2021-06-15', 'operational', '2026-07-01', '2026-08-01', '2026-09-15', 'Abbott Service KSA'),
  ('i0000001-0000-4000-8000-000000000002', 'STA-R Max 3', 'Stago', 'STA-R Max 3', 'STAR-2020-0187', 'Hematology Lab - Coag Bench', '2020-11-20', 'operational', '2026-06-20', '2026-07-20', '2026-08-20', 'Stago Middle East'),
  ('i0000001-0000-4000-8000-000000000003', 'Alifax ESR', 'Alifax', 'Test-1', 'ALX-ESR-2022-0093', 'Hematology Lab - ESR Station', '2022-03-10', 'operational', '2026-07-10', '2026-08-10', '2027-03-10', 'Alifax Regional Support');

-- ============================================================================
-- ============================================================================
-- FTE RECORDS
-- ============================================================================

INSERT INTO public.fte_records (employee_id, period_start, period_end, fte_value, productive_hours, scheduled_hours, notes) VALUES
  ('e0000001-0000-4000-8000-000000000008', '2026-06-01', '2026-06-30', 0.950, 152.0, 160.0, 'Strong attendance'),
  ('e0000001-0000-4000-8000-000000000009', '2026-06-01', '2026-06-30', 0.875, 140.0, 160.0, 'Approved leave days'),
  ('e0000001-0000-4000-8000-000000000010', '2026-06-01', '2026-06-30', 0.925, 148.0, 160.0, NULL),
  ('e0000001-0000-4000-8000-000000000011', '2026-06-01', '2026-06-30', 0.900, 144.0, 160.0, NULL),
  ('e0000001-0000-4000-8000-000000000012', '2026-06-01', '2026-06-30', 0.850, 136.0, 160.0, 'Night shift coverage gaps'),
  ('e0000001-0000-4000-8000-000000000006', '2026-06-01', '2026-06-30', 0.975, 156.0, 160.0, 'Excellent productivity');

-- ============================================================================
-- TASKS
-- ============================================================================

INSERT INTO public.tasks (
  id, title, description, assigned_to, assigned_by, priority, status,
  start_date, due_date, recurrence, task_type, approval_status, created_by
) VALUES
  ('t0000001-0000-4000-8000-000000000001', 'Daily Alinity startup checklist', 'Complete startup, QC review, and reagent level check', 'e0000001-0000-4000-8000-000000000008', 'p0000001-0000-4000-8000-000000000001', 'high', 'in_progress', CURRENT_DATE, CURRENT_DATE, 'daily', 'daily', NULL, 'p0000001-0000-4000-8000-000000000001'),
  ('t0000001-0000-4000-8000-000000000002', 'Weekly coagulation reagent inventory', 'Verify STA-R reagent levels and expiry dates', 'e0000001-0000-4000-8000-000000000006', 'p0000001-0000-4000-8000-000000000001', 'medium', 'not_started', CURRENT_DATE, CURRENT_DATE + 3, 'weekly', 'weekly', NULL, 'p0000001-0000-4000-8000-000000000001'),
  ('t0000001-0000-4000-8000-000000000003', 'Review June QC outliers', 'Investigate PT and APTT QC warnings from last week', 'e0000001-0000-4000-8000-000000000005', 'p0000001-0000-4000-8000-000000000001', 'high', 'pending_review', CURRENT_DATE - 5, CURRENT_DATE + 2, 'none', 'team', 'pending', 'p0000001-0000-4000-8000-000000000001'),
  ('t0000001-0000-4000-8000-000000000004', 'ESR control verification', 'Run Alifax ESR control levels 1 and 2', 'e0000001-0000-4000-8000-000000000010', 'p0000001-0000-4000-8000-000000000001', 'medium', 'completed', CURRENT_DATE - 1, CURRENT_DATE - 1, 'daily', 'daily', 'approved', 'p0000001-0000-4000-8000-000000000001'),
  ('t0000001-0000-4000-8000-000000000005', 'Competency assessment - Musa', 'Complete CBC running competency for new technologist', 'e0000001-0000-4000-8000-000000000004', 'p0000001-0000-4000-8000-000000000001', 'critical', 'in_progress', CURRENT_DATE - 7, CURRENT_DATE + 7, 'none', 'personal', NULL, 'p0000001-0000-4000-8000-000000000001');

INSERT INTO public.task_comments (task_id, author_id, comment) VALUES
  ('t0000001-0000-4000-8000-000000000001', 'p0000001-0000-4000-8000-000000000001', 'Startup completed; awaiting QC sign-off'),
  ('t0000001-0000-4000-8000-000000000003', 'p0000001-0000-4000-8000-000000000001', 'Root cause appears to be reagent lot change');

-- ============================================================================
-- MAINTENANCE
-- ============================================================================

INSERT INTO public.maintenance_records (
  id, instrument_id, maintenance_type, maintenance_date, shift, performed_by,
  result, issue_found, corrective_action, supervisor_review, review_date, created_by
) VALUES
  ('m0000001-0000-4000-8000-000000000001', 'i0000001-0000-4000-8000-000000000001', 'daily', CURRENT_DATE, 'morning', 'e0000001-0000-4000-8000-000000000008', 'pass', NULL, NULL, TRUE, CURRENT_DATE, 'p0000001-0000-4000-8000-000000000001'),
  ('m0000001-0000-4000-8000-000000000002', 'i0000001-0000-4000-8000-000000000002', 'weekly', CURRENT_DATE - 2, 'morning', 'e0000001-0000-4000-8000-000000000006', 'partial', 'Minor probe alignment drift', 'Recalibrated probe; repeat QC passed', TRUE, CURRENT_DATE - 1, 'p0000001-0000-4000-8000-000000000001'),
  ('m0000001-0000-4000-8000-000000000003', 'i0000001-0000-4000-8000-000000000003', 'monthly', CURRENT_DATE - 10, 'evening', 'e0000001-0000-4000-8000-000000000009', 'pass', NULL, NULL, TRUE, CURRENT_DATE - 9, 'p0000001-0000-4000-8000-000000000001');

INSERT INTO public.maintenance_checklist_items (maintenance_record_id, item_order, item_text, is_completed) VALUES
  ('m0000001-0000-4000-8000-000000000001', 1, 'Power on and system initialization', TRUE),
  ('m0000001-0000-4000-8000-000000000001', 2, 'Check reagent levels', TRUE),
  ('m0000001-0000-4000-8000-000000000001', 3, 'Review overnight error log', TRUE),
  ('m0000001-0000-4000-8000-000000000001', 4, 'Run startup QC', TRUE),
  ('m0000001-0000-4000-8000-000000000002', 1, 'Clean sample probe', TRUE),
  ('m0000001-0000-4000-8000-000000000002', 2, 'Verify calibration status', TRUE),
  ('m0000001-0000-4000-8000-000000000002', 3, 'Inspect waste container levels', FALSE);

-- ============================================================================
-- QC RECORDS
-- ============================================================================

INSERT INTO public.qc_records (
  instrument_id, test_name, control_level, lot_number, expiry_date, recorded_at,
  result_value, mean_value, standard_deviation, cv_percent, range_min, range_max, status, created_by
) VALUES
  ('i0000001-0000-4000-8000-000000000001', 'CBC', 'Level 1', 'CBC-L1-2026A', '2026-12-31', NOW() - INTERVAL '2 hours', 7.2, 7.0, 0.3, 4.29, 6.1, 7.9, 'accepted', 'p0000001-0000-4000-8000-000000000001'),
  ('i0000001-0000-4000-8000-000000000001', 'CBC', 'Level 2', 'CBC-L2-2026A', '2026-12-31', NOW() - INTERVAL '2 hours', 14.8, 14.5, 0.5, 3.45, 13.0, 16.0, 'accepted', 'p0000001-0000-4000-8000-000000000001'),
  ('i0000001-0000-4000-8000-000000000002', 'PT', 'Normal', 'PT-N-2026B', '2026-10-15', NOW() - INTERVAL '1 day', 13.8, 13.0, 0.8, 6.15, 11.4, 14.6, 'warning', 'p0000001-0000-4000-8000-000000000001'),
  ('i0000001-0000-4000-8000-000000000002', 'APTT', 'Normal', 'APTT-N-2026B', '2026-10-15', NOW() - INTERVAL '1 day', 34.5, 32.0, 2.5, 7.81, 27.0, 37.0, 'accepted', 'p0000001-0000-4000-8000-000000000001'),
  ('i0000001-0000-4000-8000-000000000003', 'ESR', 'Level 1', 'ESR-L1-2026C', '2027-01-31', NOW() - INTERVAL '4 hours', 12.0, 12.0, 2.0, 16.67, 8.0, 16.0, 'accepted', 'p0000001-0000-4000-8000-000000000001');

-- ============================================================================
-- CLINICAL OPERATIONS (fake patient IDs)
-- ============================================================================

INSERT INTO public.critical_values (
  recorded_at, record_date, patient_id, patient_name, patient_acc_number, test_name,
  critical_value, department, informed_to_dr, dr_id, verify_time, informed_time,
  comment, initial, reported_by, created_by
) VALUES
  (NOW() - INTERVAL '3 hours', CURRENT_DATE, 'FAKE-PAT-2026-00001', 'Demo Patient One', 'ACC-00001', 'Platelet Count', '18 x10^9/L', 'Hematology', 'Dr. Sample Physician', 'DR-001', '08:00', '08:15', 'Read-back confirmed', 'SA', 'p0000001-0000-4000-8000-000000000001', 'p0000001-0000-4000-8000-000000000001'),
  (NOW() - INTERVAL '6 hours', CURRENT_DATE, 'FAKE-PAT-2026-00002', 'Demo Patient Two', 'ACC-00002', 'INR', '5.8', 'Hematology', 'Dr. Demo Clinician', 'DR-002', '07:30', '07:45', NULL, 'SA', 'p0000001-0000-4000-8000-000000000001', 'p0000001-0000-4000-8000-000000000001'),
  (NOW() - INTERVAL '1 hour', CURRENT_DATE, 'FAKE-PAT-2026-00003', 'Demo Patient Three', 'ACC-00003', 'Hemoglobin', '6.2 g/dL', 'Hematology', 'Pending', 'DR-000', '09:00', '09:00', 'Awaiting physician callback', 'SA', 'p0000001-0000-4000-8000-000000000001', 'p0000001-0000-4000-8000-000000000001');

INSERT INTO public.sample_rejections (
  patient_id, patient_name, patient_lab_accession, department_name,
  rejection_date, rejection_time, rejected_tests, rejected_tube, rejection_reasons,
  informed_nurse_name, nurse_id, nurse_notification_date, nurse_notification_time,
  created_by_staff_name, created_by_staff_id, record_created_date, record_created_time,
  created_by, discard_due_at
) VALUES
  ('FAKE-PAT-2026-00004', 'Demo Patient Four', 'ACC-00004', 'Hematology Section', CURRENT_DATE, '08:00', '["CBC"]'::jsonb, 'EDTA Whole Blood', '["Hemolyzed sample"]'::jsonb, 'Demo Nurse', 'N-001', CURRENT_DATE, '08:05', 'Demo Staff', 'HEM-008', CURRENT_DATE, '08:10', 'p0000001-0000-4000-8000-000000000001', NOW() + INTERVAL '3 days'),
  ('FAKE-PAT-2026-00005', 'Demo Patient Five', 'ACC-00005', 'Hematology Section', CURRENT_DATE - 1, '10:00', '["PT/INR"]'::jsonb, 'Citrate Plasma', '["Insufficient volume"]'::jsonb, 'Demo Nurse', 'N-002', CURRENT_DATE - 1, '10:05', 'Demo Staff', 'HEM-006', CURRENT_DATE - 1, '10:10', 'p0000001-0000-4000-8000-000000000001', NOW() - INTERVAL '1 day'),
  ('FAKE-PAT-2026-00006', 'Demo Patient Six', 'ACC-00006', 'Hematology Section', CURRENT_DATE - 2, '14:00', '["ESR"]'::jsonb, 'EDTA Whole Blood', '["Clotted sample"]'::jsonb, 'Demo Nurse', 'N-003', CURRENT_DATE - 2, '14:05', 'Demo Staff', 'HEM-009', CURRENT_DATE - 2, '14:10', 'p0000001-0000-4000-8000-000000000001', NOW() - INTERVAL '2 days');

INSERT INTO public.corrected_results (
  correction_date, patient_id, test_name, original_result, corrected_result,
  reason, corrected_by, physician_notified, notification_time, notes, created_by
) VALUES
  (CURRENT_DATE - 1, 'FAKE-PAT-2026-00007', 'WBC', '12.5', '11.8', 'Transcription error during manual verification', 'p0000001-0000-4000-8000-000000000001', TRUE, NOW() - INTERVAL '20 hours', 'Corrected before final report release', 'p0000001-0000-4000-8000-000000000001'),
  (CURRENT_DATE - 3, 'FAKE-PAT-2026-00008', 'PT', '15.2 sec', '13.9 sec', 'Sample carryover suspected; repeat run performed', 'p0000001-0000-4000-8000-000000000001', TRUE, NOW() - INTERVAL '3 days', NULL, 'p0000001-0000-4000-8000-000000000001');

INSERT INTO public.tat_records (
  sample_received_time, result_released_time, calculated_tat_minutes, target_tat_minutes,
  test_type, priority, department, shift, instrument_id, status
) VALUES
  (NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours', 60, 60, 'CBC', 'stat', 'Hematology', 'morning', 'i0000001-0000-4000-8000-000000000001', 'within_target'),
  (NOW() - INTERVAL '5 hours', NOW() - INTERVAL '1 hour', 240, 240, 'Coagulation Panel', 'routine', 'Hematology', 'morning', 'i0000001-0000-4000-8000-000000000002', 'within_target'),
  (NOW() - INTERVAL '6 hours', NOW() - INTERVAL '4 hours 30 minutes', 90, 60, 'D-Dimer', 'stat', 'Hematology', 'morning', 'i0000001-0000-4000-8000-000000000002', 'breached'),
  (NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 30 minutes', 30, 45, 'ESR', 'routine', 'Hematology', 'morning', 'i0000001-0000-4000-8000-000000000003', 'within_target');

INSERT INTO public.pending_samples (
  patient_id, test_name, priority, received_time, elapsed_minutes,
  instrument_id, assigned_staff_id, current_status, delay_reason
) VALUES
  ('FAKE-PAT-2026-00009', 'CBC + Diff', 'stat', NOW() - INTERVAL '35 minutes', 35, 'i0000001-0000-4000-8000-000000000001', 'e0000001-0000-4000-8000-000000000008', 'in_analysis', NULL),
  ('FAKE-PAT-2026-00010', 'PT/INR', 'routine', NOW() - INTERVAL '120 minutes', 120, 'i0000001-0000-4000-8000-000000000002', 'e0000001-0000-4000-8000-000000000006', 'queued', NULL),
  ('FAKE-PAT-2026-00011', 'ESR', 'routine', NOW() - INTERVAL '200 minutes', 200, 'i0000001-0000-4000-8000-000000000003', 'e0000001-0000-4000-8000-000000000010', 'pending_verification', 'Awaiting supervisor review');

-- ============================================================================
-- TRAINING
-- ============================================================================

INSERT INTO public.training_courses (
  id, title, description, category, instructor, start_date, due_date, passing_score, status
) VALUES
  ('c0000001-0000-4000-8000-000000000001', 'Hematology Safety Refresher', 'Annual safety and biosafety refresher for hematology staff', 'Safety', 'Ahmed', CURRENT_DATE - 30, CURRENT_DATE + 60, 80, 'active'),
  ('c0000001-0000-4000-8000-000000000002', 'Alinity HQ Operations', 'Instrument operation and troubleshooting for Alinity HQ', 'Instrument', 'Renad', CURRENT_DATE - 14, CURRENT_DATE + 45, 85, 'active'),
  ('c0000001-0000-4000-8000-000000000003', 'Critical Value Communication', 'Protocol for critical result notification and read-back', 'Quality', 'Nahla', CURRENT_DATE - 7, CURRENT_DATE + 30, 90, 'active');

INSERT INTO public.quizzes (id, course_id, title, time_limit_minutes, max_attempts, passing_score) VALUES
  ('q0000001-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000001', 'Safety Refresher Quiz', 30, 3, 80),
  ('q0000001-0000-4000-8000-000000000002', 'c0000001-0000-4000-8000-000000000002', 'Alinity HQ Quiz', 45, 2, 85);

INSERT INTO public.quiz_questions (quiz_id, question_order, question_text, options, correct_answer, points) VALUES
  ('q0000001-0000-4000-8000-000000000001', 1, 'What PPE is required when handling uncapped blood samples?', '["Gloves only","Gloves and lab coat","Gloves, lab coat, and face protection","No PPE required"]'::JSONB, 'Gloves, lab coat, and face protection', 1),
  ('q0000001-0000-4000-8000-000000000001', 2, 'Spill response first step?', '["Notify supervisor","Apply disinfectant","Don appropriate PPE","Discard all samples"]'::JSONB, 'Don appropriate PPE', 1),
  ('q0000001-0000-4000-8000-000000000002', 1, 'Daily startup includes which QC action?', '["Skip QC if reagents unchanged","Run controls per schedule","Run patient sample as QC","QC only on Mondays"]'::JSONB, 'Run controls per schedule', 1);

INSERT INTO public.training_enrollments (course_id, employee_id, status, score) VALUES
  ('c0000001-0000-4000-8000-000000000001', 'e0000001-0000-4000-8000-000000000008', 'completed', 92),
  ('c0000001-0000-4000-8000-000000000001', 'e0000001-0000-4000-8000-000000000012', 'in_progress', NULL),
  ('c0000001-0000-4000-8000-000000000002', 'e0000001-0000-4000-8000-000000000010', 'enrolled', NULL),
  ('c0000001-0000-4000-8000-000000000003', 'e0000001-0000-4000-8000-000000000006', 'completed', 95);

INSERT INTO public.competencies (employee_id, competency_name, category, assessment_date, status, score, valid_until) VALUES
  ('e0000001-0000-4000-8000-000000000012', 'CBC Analysis', 'Instrument', CURRENT_DATE - 5, 'in_progress', NULL, CURRENT_DATE + 180),
  ('e0000001-0000-4000-8000-000000000008', 'Critical Value Notification', 'Quality', CURRENT_DATE - 60, 'verified', 95, CURRENT_DATE + 305),
  ('e0000001-0000-4000-8000-000000000006', 'Coagulation Testing', 'Instrument', CURRENT_DATE - 90, 'verified', 98, CURRENT_DATE + 275);

INSERT INTO public.certificates (employee_id, course_id, certificate_number, title, issued_date, expiry_date) VALUES
  ('e0000001-0000-4000-8000-000000000008', 'c0000001-0000-4000-8000-000000000001', 'CERT-HEM-2026-0001', 'Hematology Safety Refresher 2026', CURRENT_DATE - 10, CURRENT_DATE + 355),
  ('e0000001-0000-4000-8000-000000000006', 'c0000001-0000-4000-8000-000000000003', 'CERT-HEM-2026-0002', 'Critical Value Communication 2026', CURRENT_DATE - 3, CURRENT_DATE + 362);

-- ============================================================================
-- DOCUMENTS
-- ============================================================================

INSERT INTO public.documents (
  id, document_number, title, category, current_version, effective_date, review_date,
  owner_id, status, revision_notes, created_by
) VALUES
  ('d0000001-0000-4000-8000-000000000001', 'SOP-HEM-001', 'CBC Sample Acceptance Criteria', 'SOP', '3.2', '2026-01-01', '2027-01-01', 'p0000001-0000-4000-8000-000000000001', 'approved', 'Updated hemolysis rejection criteria', 'p0000001-0000-4000-8000-000000000001'),
  ('d0000001-0000-4000-8000-000000000002', 'SOP-HEM-015', 'Critical Value Notification Procedure', 'SOP', '2.0', '2025-06-01', '2026-06-01', 'p0000001-0000-4000-8000-000000000001', 'approved', 'Added read-back documentation requirements', 'p0000001-0000-4000-8000-000000000001'),
  ('d0000001-0000-4000-8000-000000000003', 'POL-HEM-004', 'Hematology Section Quality Policy', 'Policy', '1.1', '2024-09-01', '2025-09-01', 'p0000001-0000-4000-8000-000000000001', 'under_review', 'Annual review in progress', 'p0000001-0000-4000-8000-000000000001');

INSERT INTO public.document_versions (document_id, version_number, file_path, change_summary, uploaded_by, is_current) VALUES
  ('d0000001-0000-4000-8000-000000000001', '3.2', '/documents/SOP-HEM-001/v3.2.pdf', 'Updated hemolysis criteria', 'p0000001-0000-4000-8000-000000000001', TRUE),
  ('d0000001-0000-4000-8000-000000000002', '2.0', '/documents/SOP-HEM-015/v2.0.pdf', 'Read-back requirements added', 'p0000001-0000-4000-8000-000000000001', TRUE);

INSERT INTO public.document_acknowledgements (document_id, employee_id) VALUES
  ('d0000001-0000-4000-8000-000000000001', 'e0000001-0000-4000-8000-000000000008'),
  ('d0000001-0000-4000-8000-000000000001', 'e0000001-0000-4000-8000-000000000010'),
  ('d0000001-0000-4000-8000-000000000002', 'e0000001-0000-4000-8000-000000000006');

-- ============================================================================
-- INVENTORY
-- ============================================================================

INSERT INTO public.inventory_items (
  id, item_name, category, manufacturer, catalog_number, lot_number,
  quantity, unit, minimum_stock, maximum_stock, expiry_date, storage_location, status, barcode
) VALUES
  ('v0000001-0000-4000-8000-000000000001', 'CBC Control Level 1', 'QC Material', 'Abbott', 'CBC-CTL-L1', 'CBC-L1-2026A', 12.0, 'vials', 5.0, 20.0, '2026-12-31', 'Refrigerator A - Shelf 2', 'available', 'INV-CBC-L1-001'),
  ('v0000001-0000-4000-8000-000000000002', 'PT Control Normal', 'QC Material', 'Stago', 'PT-CTL-N', 'PT-N-2026B', 3.0, 'vials', 4.0, 15.0, '2026-10-15', 'Refrigerator B - Shelf 1', 'low_stock', 'INV-PT-N-002'),
  ('v0000001-0000-4000-8000-000000000003', 'EDTA Vacutainer 3mL', 'Consumables', 'BD', '366450', 'EDTA-2026Q2', 850.0, 'tubes', 200.0, 1500.0, '2027-06-30', 'Supply Room - Rack 4', 'available', 'INV-EDTA-003');

INSERT INTO public.inventory_transactions (
  item_id, transaction_type, quantity_change, quantity_before, quantity_after, reference_number, reason, performed_by
) VALUES
  ('v0000001-0000-4000-8000-000000000001', 'issue', -2.0, 14.0, 12.0, 'ISS-2026-0142', 'Daily QC run', 'p0000001-0000-4000-8000-000000000001'),
  ('v0000001-0000-4000-8000-000000000002', 'receive', 5.0, 0.0, 5.0, 'RCV-2026-0088', 'New lot received', 'p0000001-0000-4000-8000-000000000001'),
  ('v0000001-0000-4000-8000-000000000002', 'issue', -2.0, 5.0, 3.0, 'ISS-2026-0143', 'Weekly coag QC', 'p0000001-0000-4000-8000-000000000001');

-- ============================================================================
-- MEETINGS
-- ============================================================================

INSERT INTO public.meetings (
  id, title, meeting_date, meeting_time, location, organizer_id, agenda, discussion, decisions, minutes_approved, created_by
) VALUES
  ('f0000001-0000-4000-8000-000000000001', 'Hematology Monthly Quality Review', CURRENT_DATE - 7, '09:00', 'Conference Room B', 'p0000001-0000-4000-8000-000000000001', 'Review QC trends, TAT breaches, open CAPAs', 'Discussed PT QC warning and TAT breach on D-Dimer stat samples', 'Action: Retrain staff on stat prioritization', TRUE, 'p0000001-0000-4000-8000-000000000001'),
  ('f0000001-0000-4000-8000-000000000002', 'Section Huddle', CURRENT_DATE, '07:30', 'Hematology Lab', 'p0000001-0000-4000-8000-000000000001', 'Daily workload, instrument status, pending samples', NULL, NULL, FALSE, 'p0000001-0000-4000-8000-000000000001');

INSERT INTO public.meeting_attendees (meeting_id, employee_id, attendance_status, attended) VALUES
  ('f0000001-0000-4000-8000-000000000001', 'e0000001-0000-4000-8000-000000000003', 'present', TRUE),
  ('f0000001-0000-4000-8000-000000000001', 'e0000001-0000-4000-8000-000000000004', 'present', TRUE),
  ('f0000001-0000-4000-8000-000000000001', 'e0000001-0000-4000-8000-000000000005', 'present', TRUE),
  ('f0000001-0000-4000-8000-000000000002', 'e0000001-0000-4000-8000-000000000008', 'present', TRUE),
  ('f0000001-0000-4000-8000-000000000002', 'e0000001-0000-4000-8000-000000000010', 'present', TRUE);

INSERT INTO public.meeting_actions (meeting_id, action_text, assigned_to, due_date, status, created_by) VALUES
  ('f0000001-0000-4000-8000-000000000001', 'Investigate PT QC lot change impact', 'e0000001-0000-4000-8000-000000000005', CURRENT_DATE + 7, 'in_progress', 'p0000001-0000-4000-8000-000000000001'),
  ('f0000001-0000-4000-8000-000000000001', 'Conduct stat sample prioritization refresher', 'e0000001-0000-4000-8000-000000000004', CURRENT_DATE + 14, 'open', 'p0000001-0000-4000-8000-000000000001');

-- ============================================================================
-- RISK, INCIDENTS & CAPA
-- ============================================================================

INSERT INTO public.risks (
  title, category, description, likelihood, severity, risk_score,
  existing_controls, action_plan, owner_id, due_date, residual_risk, status, created_by
) VALUES
  ('Delayed critical value notification', 'Clinical', 'Risk of delayed physician notification for critical hematology results', 3, 4, 12, 'SOP-HEM-015, automated alerts', 'Implement escalation timer and supervisor notification', 'p0000001-0000-4000-8000-000000000001', CURRENT_DATE + 30, 6, 'in_progress', 'p0000001-0000-4000-8000-000000000001'),
  ('Reagent stock-out', 'Operational', 'Low stock of coagulation QC material may halt testing', 2, 3, 6, 'Minimum stock alerts', 'Increase par level and add secondary supplier', 'p0000001-0000-4000-8000-000000000001', CURRENT_DATE + 14, 3, 'open', 'p0000001-0000-4000-8000-000000000001');

INSERT INTO public.incidents (
  title, incident_type, severity, description, occurred_at, reported_by, patient_id, instrument_id, immediate_action, status, created_by
) VALUES
  ('Sample mislabeling near-miss', 'Pre-analytical', 'minor', 'Sample label did not match requisition; caught before analysis', NOW() - INTERVAL '2 days', 'p0000001-0000-4000-8000-000000000001', 'FAKE-PAT-2026-00012', NULL, 'Returned to collection area for relabeling', 'resolved', 'p0000001-0000-4000-8000-000000000001'),
  ('STA-R probe error during stat run', 'Analytical', 'moderate', 'Probe error caused repeat required on stat coag sample', NOW() - INTERVAL '1 day', 'p0000001-0000-4000-8000-000000000001', 'FAKE-PAT-2026-00013', 'i0000001-0000-4000-8000-000000000002', 'Repeated sample; maintenance checklist completed', 'investigating', 'p0000001-0000-4000-8000-000000000001');

INSERT INTO public.capa_records (
  source, problem_statement, immediate_correction, root_cause, corrective_action,
  preventive_action, owner_id, due_date, status, created_by
) VALUES
  ('QC Trend Review', 'PT QC results trending high after reagent lot change', 'Paused reporting and repeated QC', 'Insufficient validation after lot change', 'Complete full QC validation for new lot', 'Update lot change checklist to require 5-day QC review', 'p0000001-0000-4000-8000-000000000001', CURRENT_DATE + 21, 'in_progress', 'p0000001-0000-4000-8000-000000000001'),
  ('TAT Breach', 'Stat D-Dimer TAT exceeded target on multiple occasions', 'Escalated pending sample to supervisor', 'Insufficient stat prioritization during morning rush', 'Retrain staff on stat workflow', 'Add visual stat queue indicator at bench', 'p0000001-0000-4000-8000-000000000001', CURRENT_DATE + 10, 'open', 'p0000001-0000-4000-8000-000000000001');

-- ============================================================================
-- REPORTS & AUDIT
-- ============================================================================

INSERT INTO public.reports (title, report_type, period_start, period_end, generated_by, status, content) VALUES
  ('June 2026 Hematology KPI Report', 'kpi', '2026-06-01', '2026-06-30', 'p0000001-0000-4000-8000-000000000001', 'approved', '{"tatCompliance":92.5,"qcAcceptance":98.1,"criticalValueNotification":96.0}'::JSONB),
  ('Q2 2026 Quality Summary', 'quality', '2026-04-01', '2026-06-30', 'p0000001-0000-4000-8000-000000000001', 'published', '{"openCapa":2,"closedCapa":1,"incidents":2}'::JSONB);

INSERT INTO public.employee_evaluations (
  employee_id, period, fte, staff_evaluation, supervisor_evaluation,
  lab_manager_evaluation, lab_director_evaluation, final_score, rating, created_by
) VALUES
  ('e0000001-0000-4000-8000-000000000008', '2026-H1', 0.950, 4, 4, 4, 5, 88.00, 'exceeds_expectations', 'p0000001-0000-4000-8000-000000000001'),
  ('e0000001-0000-4000-8000-000000000012', '2026-H1', 0.850, 3, 3, 3, 4, 72.00, 'meets_expectations', 'p0000001-0000-4000-8000-000000000001');

INSERT INTO public.audit_logs (user_id, action, module, record_id, new_value) VALUES
  ('p0000001-0000-4000-8000-000000000001', 'seed', 'system', NULL, '{"message":"Initial seed data loaded"}'::JSONB),
  ('p0000001-0000-4000-8000-000000000001', 'create', 'qc', NULL, '{"instrument":"Abbott Alinity HQ","test":"CBC"}'::JSONB);

COMMIT;
