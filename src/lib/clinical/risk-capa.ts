import { createClient } from '@/lib/supabase/client';
import type { CAPARecord, Risk } from '@/types';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface RiskRow {
  id: string;
  title: string;
  category: string;
  description: string;
  likelihood: number;
  severity: number;
  risk_score: number;
  existing_controls: string | null;
  action_plan: string | null;
  owner_id: string;
  due_date: string;
  residual_risk: number | null;
  status: Risk['status'];
  created_at: string;
}

interface CapaRow {
  id: string;
  source: string;
  problem_statement: string;
  immediate_correction: string | null;
  root_cause: string | null;
  corrective_action: string | null;
  preventive_action: string | null;
  owner_id: string;
  due_date: string;
  evidence: string | null;
  effectiveness_review: string | null;
  closure_approval: boolean;
  status: CAPARecord['status'];
  created_at: string;
}

function mapRisk(row: RiskRow): Risk {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    likelihood: row.likelihood,
    severity: row.severity,
    riskScore: row.risk_score,
    existingControls: row.existing_controls ?? undefined,
    actionPlan: row.action_plan ?? undefined,
    ownerId: row.owner_id,
    dueDate: row.due_date,
    residualRisk: row.residual_risk ?? undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapCapa(row: CapaRow): CAPARecord {
  return {
    id: row.id,
    source: row.source,
    problemStatement: row.problem_statement,
    immediateCorrection: row.immediate_correction ?? undefined,
    rootCause: row.root_cause ?? undefined,
    correctiveAction: row.corrective_action ?? undefined,
    preventiveAction: row.preventive_action ?? undefined,
    ownerId: row.owner_id,
    dueDate: row.due_date,
    evidence: row.evidence ?? undefined,
    effectivenessReview: row.effectiveness_review ?? undefined,
    closureApproval: row.closure_approval,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function fetchRisks(): Promise<ClinicalListResult<Risk>> {
  return runClinicalListQuery('Failed to load risks', async () => {
    const supabase = createClient();
    return supabase.from('risks').select('*').is('deleted_at', null).order('created_at', { ascending: false });
  }).then((result) => ({
    data: (result.data as unknown as RiskRow[]).map(mapRisk),
    error: result.error,
  }));
}

export async function fetchCapaRecords(): Promise<ClinicalListResult<CAPARecord>> {
  return runClinicalListQuery('Failed to load CAPA records', async () => {
    const supabase = createClient();
    return supabase.from('capa_records').select('*').is('deleted_at', null).order('created_at', { ascending: false });
  }).then((result) => ({
    data: (result.data as unknown as CapaRow[]).map(mapCapa),
    error: result.error,
  }));
}

export async function createRisk(
  userId: string,
  input: { title: string; category: string; likelihood: number; severity: number },
): Promise<ClinicalResult<Risk>> {
  const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  return runClinicalMutation('Failed to create risk', async () => {
    const supabase = createClient();
    return supabase.from('risks').insert({
      title: input.title.trim(),
      category: input.category,
      description: 'Risk registered via portal',
      likelihood: input.likelihood,
      severity: input.severity,
      risk_score: input.likelihood * input.severity,
      owner_id: userId,
      due_date: dueDate,
      created_by: userId,
    }).select('*').single();
  }).then((result) => ({
    data: result.data ? mapRisk(result.data as unknown as RiskRow) : null,
    error: result.error,
  }));
}

export async function createCapaRecord(
  userId: string,
  input: { source: string; problemStatement: string },
): Promise<ClinicalResult<CAPARecord>> {
  const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  return runClinicalMutation('Failed to create CAPA record', async () => {
    const supabase = createClient();
    return supabase.from('capa_records').insert({
      source: input.source.trim(),
      problem_statement: input.problemStatement.trim(),
      owner_id: userId,
      due_date: dueDate,
      created_by: userId,
    }).select('*').single();
  }).then((result) => ({
    data: result.data ? mapCapa(result.data as unknown as CapaRow) : null,
    error: result.error,
  }));
}

export async function softDeleteRisk(id: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete risk', async () => {
    const supabase = createClient();
    return supabase.from('risks').update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id').single();
  });
  return { error: result.error };
}

export async function softDeleteCapa(id: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete CAPA record', async () => {
    const supabase = createClient();
    return supabase.from('capa_records').update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id').single();
  });
  return { error: result.error };
}
