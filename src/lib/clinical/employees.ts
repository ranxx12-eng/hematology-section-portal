import { createClient } from '@/lib/supabase/client';
import type { EmployeeFormData } from '@/lib/employees/schema';
import type { Employee, EmployeeEvaluation } from '@/types';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface EmployeeRow {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  job_title: string;
  role: Employee['role'];
  section: string;
  hire_date: string;
  employment_status: Employee['employmentStatus'];
  shift: Employee['shift'];
  supervisor_id: string | null;
  profile_photo: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    employeeId: row.employee_code,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone ?? undefined,
    jobTitle: row.job_title,
    role: row.role,
    section: row.section,
    hireDate: row.hire_date,
    employmentStatus: row.employment_status,
    shift: row.shift,
    supervisorId: row.supervisor_id ?? undefined,
    profilePhoto: row.profile_photo ?? undefined,
    notes: row.notes ?? undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formToInsertRow(form: EmployeeFormData, userId: string, employeeCode: string) {
  return {
    employee_code: employeeCode,
    full_name: form.fullName.trim(),
    email: form.email.trim().toLowerCase(),
    phone: form.phone?.trim() || null,
    job_title: form.jobTitle.trim(),
    role: form.role,
    section: form.section,
    hire_date: form.hireDate ?? new Date().toISOString().slice(0, 10),
    employment_status: form.employmentStatus,
    shift: form.shift,
    is_active: form.employmentStatus === 'active',
    created_by: userId,
  };
}

function formToUpdateRow(form: EmployeeFormData) {
  const row: Record<string, unknown> = {
    full_name: form.fullName.trim(),
    email: form.email.trim().toLowerCase(),
    phone: form.phone?.trim() || null,
    job_title: form.jobTitle.trim(),
    role: form.role,
    section: form.section,
    employment_status: form.employmentStatus,
    shift: form.shift,
    is_active: form.employmentStatus === 'active',
  };
  if (form.employeeCode?.trim()) {
    row.employee_code = form.employeeCode.trim();
  }
  return row;
}

const EMPLOYEE_SELECT = '*';

export async function fetchEmployees(): Promise<ClinicalListResult<Employee>> {
  return runClinicalListQuery('Failed to load employees', async () => {
    const supabase = createClient();
    return supabase
      .from('employees')
      .select(EMPLOYEE_SELECT)
      .is('deleted_at', null)
      .order('full_name');
  }).then((result) => ({
    data: (result.data as unknown as EmployeeRow[]).map(mapEmployee),
    error: result.error,
  }));
}

export async function fetchEmployeeById(id: string): Promise<ClinicalResult<Employee>> {
  return runClinicalMutation('Failed to load employee', async () => {
    const supabase = createClient();
    return supabase
      .from('employees')
      .select(EMPLOYEE_SELECT)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
  }).then((result) => ({
    data: result.data ? mapEmployee(result.data as unknown as EmployeeRow) : null,
    error: result.error,
  }));
}

export async function createEmployee(
  userId: string,
  form: EmployeeFormData,
): Promise<ClinicalResult<Employee>> {
  const code = form.employeeCode?.trim() || `HEM-${Date.now().toString().slice(-6)}`;
  return runClinicalMutation('Failed to create employee', async () => {
    const supabase = createClient();
    return supabase
      .from('employees')
      .insert(formToInsertRow(form, userId, code))
      .select(EMPLOYEE_SELECT)
      .single();
  }).then((result) => ({
    data: result.data ? mapEmployee(result.data as unknown as EmployeeRow) : null,
    error: result.error,
  }));
}

export async function updateEmployee(
  id: string,
  form: EmployeeFormData,
): Promise<ClinicalResult<Employee>> {
  return runClinicalMutation('Failed to update employee', async () => {
    const supabase = createClient();
    return supabase
      .from('employees')
      .update(formToUpdateRow(form))
      .eq('id', id)
      .is('deleted_at', null)
      .select(EMPLOYEE_SELECT)
      .single();
  }).then((result) => ({
    data: result.data ? mapEmployee(result.data as unknown as EmployeeRow) : null,
    error: result.error,
  }));
}

export async function softDeleteEmployee(id: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete employee', async () => {
    const supabase = createClient();
    return supabase
      .from('employees')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();
  });
  return { error: result.error };
}

interface EmployeeEvaluationRow {
  id: string;
  employee_id: string;
  period: string;
  fte: number;
  staff_evaluation: number;
  supervisor_evaluation: number;
  lab_manager_evaluation: number;
  lab_director_evaluation: number;
  final_score: number;
  rating: EmployeeEvaluation['rating'];
  strengths: string | null;
  areas_for_improvement: string | null;
  comments: string | null;
  created_by: string;
  created_at: string;
}

function mapEvaluation(row: EmployeeEvaluationRow): EmployeeEvaluation {
  return {
    id: row.id,
    employeeId: row.employee_id,
    period: row.period,
    fte: row.fte,
    staffEvaluation: row.staff_evaluation,
    supervisorEvaluation: row.supervisor_evaluation,
    labManagerEvaluation: row.lab_manager_evaluation,
    labDirectorEvaluation: row.lab_director_evaluation,
    finalScore: row.final_score,
    rating: row.rating,
    strengths: row.strengths ?? undefined,
    areasForImprovement: row.areas_for_improvement ?? undefined,
    comments: row.comments ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function fetchLatestEmployeeEvaluation(
  employeeId: string,
): Promise<{ data: EmployeeEvaluation | null; error: string | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('employee_evaluations')
      .select('*')
      .eq('employee_id', employeeId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return {
      data: data ? mapEvaluation(data as unknown as EmployeeEvaluationRow) : null,
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to load evaluation',
    };
  }
}

export async function fetchProfileNameMap(): Promise<Record<string, string>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .is('deleted_at', null);
    if (error || !data) return {};
    return Object.fromEntries(data.map((row) => [row.id, row.full_name]));
  } catch {
    return {};
  }
}
