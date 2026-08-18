import { createClient } from '@/lib/supabase/client';
import type { ReportTemplateFormData } from '@/lib/report-builder/schema';
import { templateToFieldsConfig } from '@/lib/report-builder/schema';
import { fetchCriticalValues } from './critical-values';
import { fetchSampleRejections } from './sample-rejections';
import { fetchTasks } from './tasks';
import { fetchTATRecords } from './tat-records';
import type { ReportTemplate } from '@/types/modules';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface ReportTemplateRow {
  id: string;
  name: string;
  description: string | null;
  module: string;
  fields_config: {
    columns?: string[];
    chartType?: ReportTemplate['chartType'];
    chartColumn?: string;
  };
  filters_config: ReportTemplate['filters'];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapReportTemplate(row: ReportTemplateRow): ReportTemplate {
  return {
    id: row.id,
    name: row.name,
    table: row.module,
    columns: row.fields_config.columns ?? [],
    filters: row.filters_config ?? [],
    chartType: row.fields_config.chartType ?? 'bar',
    chartColumn: row.fields_config.chartColumn ?? row.fields_config.columns?.[0],
    createdBy: row.created_by ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const TEMPLATE_SELECT = '*';

export async function fetchReportTemplates(): Promise<ClinicalListResult<ReportTemplate>> {
  return runClinicalListQuery('Failed to load report templates', async () => {
    const supabase = createClient();
    return supabase
      .from('report_templates')
      .select(TEMPLATE_SELECT)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
  }).then((result) => ({
    data: (result.data as unknown as ReportTemplateRow[]).map(mapReportTemplate),
    error: result.error,
  }));
}

export async function createReportTemplate(
  userId: string,
  form: ReportTemplateFormData,
): Promise<ClinicalResult<ReportTemplate>> {
  const moduleDef = form.table;
  const columns = {
    criticalValues: ['date', 'patientName', 'test', 'criticalValue', 'department'],
    sampleRejections: ['patientName', 'department', 'rejectionDate', 'rejectedTests'],
    tasks: ['title', 'priority', 'status', 'dueDate'],
    tatRecords: ['testType', 'priority', 'calculatedTat', 'status'],
  }[moduleDef];

  const fieldsConfig = templateToFieldsConfig({
    columns,
    chartType: form.chartType,
    chartColumn: form.chartColumn || columns[0],
  });

  return runClinicalMutation('Failed to create report template', async () => {
    const supabase = createClient();
    return supabase
      .from('report_templates')
      .insert({
        name: form.name.trim(),
        module: moduleDef,
        fields_config: fieldsConfig,
        filters_config: [],
        created_by: userId,
        updated_by: userId,
      })
      .select(TEMPLATE_SELECT)
      .single();
  }).then((result) => ({
    data: result.data ? mapReportTemplate(result.data as unknown as ReportTemplateRow) : null,
    error: result.error,
  }));
}

export async function softDeleteReportTemplate(id: string, userId: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete report template', async () => {
    const supabase = createClient();
    return supabase
      .from('report_templates')
      .update({ deleted_at: new Date().toISOString(), updated_by: userId })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();
  });
  return { error: result.error };
}

export async function fetchReportModuleData(
  moduleKey: string,
): Promise<{ data: Record<string, unknown>[]; error: string | null }> {
  switch (moduleKey) {
    case 'criticalValues': {
      const result = await fetchCriticalValues();
      return {
        data: result.data as unknown as Record<string, unknown>[],
        error: result.error,
      };
    }
    case 'sampleRejections': {
      const result = await fetchSampleRejections();
      return {
        data: result.data.map((r) => ({
          ...r,
          rejectedTests: r.rejectedTests.join(', '),
        })) as unknown as Record<string, unknown>[],
        error: result.error,
      };
    }
    case 'tasks': {
      const result = await fetchTasks();
      return {
        data: result.data as unknown as Record<string, unknown>[],
        error: result.error,
      };
    }
    case 'tatRecords': {
      const result = await fetchTATRecords();
      return {
        data: result.data as unknown as Record<string, unknown>[],
        error: result.error,
      };
    }
    default:
      return { data: [], error: 'Unknown report module' };
  }
}
