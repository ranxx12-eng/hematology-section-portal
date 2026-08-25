import { z } from 'zod';
import type { ReportTemplate } from '@/types/modules';

export const REPORT_MODULES = {
  criticalValues: {
    label: 'Critical Values',
    columns: ['date', 'patientName', 'tests', 'criticalValue', 'department'],
  },
  sampleRejections: {
    label: 'Sample Rejections',
    columns: ['patientName', 'department', 'rejectionDate', 'rejectedTests'],
  },
  tasks: {
    label: 'Tasks',
    columns: ['title', 'priority', 'status', 'dueDate'],
  },
  tatRecords: {
    label: 'TAT Records',
    columns: ['testType', 'priority', 'calculatedTat', 'status'],
  },
} as const;

export type ReportModuleKey = keyof typeof REPORT_MODULES;

export const reportTemplateFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  table: z.enum(['criticalValues', 'sampleRejections', 'tasks', 'tatRecords']),
  chartType: z.enum(['bar', 'line', 'pie', 'none']).default('bar'),
  chartColumn: z.string().optional(),
});

export type ReportTemplateFormData = z.infer<typeof reportTemplateFormSchema>;

export function templateToFieldsConfig(template: Pick<ReportTemplate, 'columns' | 'chartType' | 'chartColumn'>) {
  return {
    columns: template.columns,
    chartType: template.chartType ?? 'bar',
    chartColumn: template.chartColumn ?? template.columns[0] ?? '',
  };
}

export function fieldsConfigToTemplate(
  module: string,
  fieldsConfig: Record<string, unknown>,
): Pick<ReportTemplate, 'table' | 'columns' | 'chartType' | 'chartColumn'> {
  return {
    table: module,
    columns: (fieldsConfig.columns as string[]) ?? [],
    chartType: (fieldsConfig.chartType as ReportTemplate['chartType']) ?? 'bar',
    chartColumn: (fieldsConfig.chartColumn as string) ?? undefined,
  };
}
