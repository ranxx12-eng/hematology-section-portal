import { formatCorrectiveActionsSummary } from '@/lib/qc-records/schema';
import {
  malariaQcAControlResultFromRecord,
  malariaQcBPrintMarks,
  materialConfigParameterForTemplate,
} from '@/lib/qc-records/malaria-qc';
import {
  formatQCDecisionLabel,
} from '@/lib/qc-records/permissions';
import type { QCPrintTemplateKey } from '@/lib/print/qc-print-templates';
import { resolveMaintenancePrintTemplateKey, resolveQCPrintTemplateKey } from '@/lib/print/qc-print-templates';
import { normalizeRecordDate } from '@/lib/print/report-date-range';
import { printTimestamp, printValue } from '@/lib/print/report-value';
import type { Instrument, MaintenanceRecord, QCRecord } from '@/types';

export interface QCControlledFormGroup {
  templateKey: Exclude<QCPrintTemplateKey, 'generic' | 'hema-008a'>;
  instrumentId: string;
  instrumentName: string;
  year: number;
  month: number;
  monthLabel: string;
  dailyRecords: QCRecord[];
  monthlyRecord?: QCRecord;
  instrument?: Pick<Instrument, 'serialNumber' | 'model' | 'manufacturer'>;
  materialLotNumber?: string;
  materialExpiryDate?: string;
}

export interface MaintenanceControlledFormGroup {
  templateKey: 'hema-008a';
  instrumentId: string;
  instrumentName: string;
  year: number;
  month: number;
  monthLabel: string;
  records: MaintenanceRecord[];
  instrument?: Pick<Instrument, 'serialNumber' | 'model' | 'manufacturer'>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatMonthYearLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1] ?? 'Unknown'} ${year}`;
}

function recordDateKey(record: QCRecord): string | null {
  return normalizeRecordDate(record.recordedAt);
}

function monthYearFromDate(dateStr: string): { year: number; month: number } {
  const [year, month] = dateStr.split('-').map(Number);
  return { year, month };
}

export function formatPrintInitials(name?: string, staffId?: string): string {
  if (staffId?.trim()) return staffId.trim();
  if (!name?.trim()) return '—';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export function formatCorrectiveActionForPrint(record: QCRecord): string {
  const summary = formatCorrectiveActionsSummary(record.correctiveActions, record.correctiveActionOther);
  const parts = [summary.trim(), record.correctiveActionComment?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(' — ') : '—';
}

export function formatDailyReviewForPrint(record: QCRecord): string {
  if (record.reviewStatus !== 'Reviewed') return '—';
  const lines = [
    formatQCDecisionLabel(record.reviewDecision),
    compactIdentity(record.reviewedByName, record.reviewedByStaffId),
    record.reviewedAt ? printTimestamp(record.reviewedAt) : '',
  ].filter((line) => line && line !== '—');
  return lines.length > 0 ? lines.join('\n') : '—';
}

export function formatDailyApprovalForPrint(record: QCRecord): string {
  if (record.approvalStatus !== 'Approved') return '—';
  const lines = [
    formatQCDecisionLabel(record.approvalDecision),
    compactIdentity(record.approvedByName, record.approvedByStaffId),
    record.approvedAt ? printTimestamp(record.approvedAt) : '',
  ].filter((line) => line && line !== '—');
  return lines.length > 0 ? lines.join('\n') : '—';
}

function compactIdentity(name?: string, staffId?: string): string {
  const id = staffId?.trim();
  const label = name?.trim();
  if (id && label) return `${label} (${id})`;
  return printValue(id ?? label);
}

export function formatMonthlyReviewSection(record?: QCRecord): string[][] {
  return [
    ['Review Decision', record ? formatQCDecisionLabel(record.reviewDecision) : '—'],
    ['Reviewed By', printValue(record?.reviewedByName)],
    ['Staff ID', printValue(record?.reviewedByStaffId)],
    ['Reviewed At', record?.reviewedAt ? printTimestamp(record.reviewedAt) : '—'],
    ['Additional Comment', printValue(record?.reviewComment)],
  ];
}

export function formatMonthlyApprovalSection(record?: QCRecord): string[][] {
  return [
    ['Approval Decision', record ? formatQCDecisionLabel(record.approvalDecision) : '—'],
    ['Approved By', printValue(record?.approvedByName)],
    ['Staff ID', printValue(record?.approvedByStaffId)],
    ['Approved At', record?.approvedAt ? printTimestamp(record.approvedAt) : '—'],
    ['Additional Comment', printValue(record?.approvalComment)],
  ];
}

function displayQcLevelResult(record: QCRecord): string {
  if (record.qcStatus === 'OUT') return 'OUT';
  if (record.comment?.trim()) return record.comment.trim();
  if (record.level?.trim()) return record.level.trim();
  return 'IN';
}

function sicklingPosNeg(record: QCRecord): { pos: string; neg: string } {
  const level = record.level.trim().toLowerCase();
  if (level === 'positive') return { pos: 'Positive', neg: '—' };
  if (level === 'negative') return { pos: '—', neg: 'Negative' };
  if (record.qcStatus === 'OUT') return { pos: '—', neg: '—' };
  return { pos: '—', neg: '—' };
}

function normalizeLevelKey(level: string): string {
  return level.trim().toLowerCase().replace(/\s+/g, '');
}

function matchManualEsrLevel(level: string): '1' | '2' | null {
  const normalized = normalizeLevelKey(level);
  if (normalized.includes('1') || normalized === 'low') return '1';
  if (normalized.includes('2') || normalized === 'high') return '2';
  return null;
}

function matchAlifaxLevel(level: string): '2' | '3' | '4' | null {
  const normalized = normalizeLevelKey(level);
  if (normalized === '2' || normalized.includes('level2')) return '2';
  if (normalized === '3' || normalized.includes('level3')) return '3';
  if (normalized === '4' || normalized.includes('level4')) return '4';
  return null;
}

function buildSharedDailyRow(record: QCRecord): [string, string, string] {
  return [
    formatCorrectiveActionForPrint(record),
    formatDailyReviewForPrint(record),
    formatDailyApprovalForPrint(record),
  ];
}

function build011Row(dateLabel: string, records: QCRecord[]): string[] {
  const record = records[0];
  return [
    dateLabel,
    malariaQcAControlResultFromRecord(record),
    compactIdentity(record.performedByName, record.performedByStaffId),
    formatDailyReviewForPrint(record),
    formatDailyApprovalForPrint(record),
  ];
}

function build012Row(dateLabel: string, records: QCRecord[]): string[] {
  const record = records[0];
  const marks = malariaQcBPrintMarks(record.level);
  return [
    dateLabel,
    marks.pfHrp,
    marks.pfLdh,
    marks.pvLdh,
    marks.negative,
    compactIdentity(record.performedByName, record.performedByStaffId),
    formatDailyReviewForPrint(record),
    formatDailyApprovalForPrint(record),
  ];
}

function build005Row(dateLabel: string, records: QCRecord[]): string[] {
  const record = records[0];
  const { pos, neg } = sicklingPosNeg(record);
  const [corrective, review, approval] = buildSharedDailyRow(record);
  return [
    dateLabel,
    pos,
    neg,
    formatPrintInitials(record.performedByName, record.performedByStaffId),
    corrective,
    review,
    approval,
  ];
}

function build006Row(dateLabel: string, records: QCRecord[]): string[] {
  let level1 = '—';
  let level2 = '—';
  for (const record of records) {
    const key = matchManualEsrLevel(record.level);
    const value = displayQcLevelResult(record);
    if (key === '1') level1 = value;
    if (key === '2') level2 = value;
    if (!key && records.length === 1) {
      level1 = value;
    }
  }
  const record = records[0];
  const [corrective, review, approval] = buildSharedDailyRow(record);
  return [
    dateLabel,
    level1,
    level2,
    formatPrintInitials(record.performedByName, record.performedByStaffId),
    corrective,
    review,
    approval,
  ];
}

function build007Row(dateLabel: string, records: QCRecord[]): string[] {
  const record = records[0];
  const [corrective, review, approval] = buildSharedDailyRow(record);
  return [
    dateLabel,
    printValue(record.level || record.comment),
    compactIdentity(record.performedByName, record.performedByStaffId),
    corrective,
    review,
    approval,
  ];
}

function build008BRow(dateLabel: string, records: QCRecord[]): string[] {
  const levels: Record<'2' | '3' | '4', string> = { '2': '—', '3': '—', '4': '—' };
  for (const record of records) {
    const key = matchAlifaxLevel(record.level);
    if (key) levels[key] = displayQcLevelResult(record);
  }
  const record = records[0];
  const [corrective, review, approval] = buildSharedDailyRow(record);
  return [
    dateLabel,
    levels['2'],
    levels['3'],
    levels['4'],
    formatPrintInitials(record.performedByName, record.performedByStaffId),
    corrective,
    review,
    approval,
  ];
}

function formatDateLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function buildControlledFormTableRows(group: QCControlledFormGroup): string[][] {
  const byDate = new Map<string, QCRecord[]>();
  for (const record of group.dailyRecords) {
    const key = recordDateKey(record);
    if (!key) continue;
    const bucket = byDate.get(key) ?? [];
    bucket.push(record);
    byDate.set(key, bucket);
  }

  const sortedDates = [...byDate.keys()].sort();
  return sortedDates.map((dateStr) => {
    const records = byDate.get(dateStr) ?? [];
    const dateLabel = formatDateLabel(dateStr);
    switch (group.templateKey) {
      case 'hema-005':
        return build005Row(dateLabel, records);
      case 'hema-006':
        return build006Row(dateLabel, records);
      case 'hema-007':
        return build007Row(dateLabel, records);
      case 'hema-008b':
        return build008BRow(dateLabel, records);
      case 'hema-011':
        return build011Row(dateLabel, records);
      case 'hema-012':
        return build012Row(dateLabel, records);
      default:
        return [];
    }
  });
}

export function groupQCRecordsForControlledPrint(
  records: QCRecord[],
  instrumentNames: Record<string, string>,
  instruments?: Record<string, Instrument>,
  materialConfigsByParameter?: Record<string, { lotNumber?: string; expiryDate?: string }>,
): { controlledGroups: QCControlledFormGroup[]; genericRecords: QCRecord[] } {
  const genericRecords: QCRecord[] = [];
  const bucket = new Map<string, QCRecord[]>();

  for (const record of records) {
    const instrumentName = instrumentNames[record.instrumentId] ?? record.instrumentId;
    const templateKey = resolveQCPrintTemplateKey(record, instrumentName);
    if (templateKey === 'generic') {
      genericRecords.push(record);
      continue;
    }
    const dateKey = recordDateKey(record);
    if (!dateKey) {
      genericRecords.push(record);
      continue;
    }
    const { year, month } = monthYearFromDate(dateKey);
    const groupKey = `${templateKey}|${record.instrumentId}|${year}-${String(month).padStart(2, '0')}`;
    const list = bucket.get(groupKey) ?? [];
    list.push(record);
    bucket.set(groupKey, list);
  }

  const controlledGroups: QCControlledFormGroup[] = [];
  for (const [groupKey, groupRecords] of bucket.entries()) {
    const [templateKey, instrumentId, monthKey] = groupKey.split('|') as [
      Exclude<QCPrintTemplateKey, 'generic' | 'hema-008a'>,
      string,
      string,
    ];
    const [yearStr, monthStr] = monthKey.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const instrumentName = instrumentNames[instrumentId] ?? instrumentId;
    const dailyRecords = groupRecords
      .filter((record) => record.qcFrequency !== 'monthly')
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    const monthlyCandidates = groupRecords
      .filter((record) => record.qcFrequency === 'monthly')
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    const materialParameter = templateKey === 'hema-011' || templateKey === 'hema-012'
      ? materialConfigParameterForTemplate(templateKey)
      : undefined;
    const materialConfig = materialParameter
      ? materialConfigsByParameter?.[materialParameter]
      : undefined;
    const malariaRecord = (templateKey === 'hema-011' || templateKey === 'hema-012')
      ? groupRecords.find((record) => record.lotNumber)
      : undefined;
    controlledGroups.push({
      templateKey,
      instrumentId,
      instrumentName,
      year,
      month,
      monthLabel: formatMonthYearLabel(year, month),
      dailyRecords,
      monthlyRecord: monthlyCandidates[0],
      instrument: instruments?.[instrumentId],
      materialLotNumber: materialConfig?.lotNumber ?? malariaRecord?.lotNumber,
      materialExpiryDate: materialConfig?.expiryDate ?? malariaRecord?.expiryDate,
    });
  }

  controlledGroups.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    if (a.month !== b.month) return b.month - a.month;
    return a.templateKey.localeCompare(b.templateKey);
  });

  return { controlledGroups, genericRecords };
}

function checklistCompleted(record: MaintenanceRecord, itemText: string): string {
  const match = record.checklist.find(
    (item) => item.item.trim().toLowerCase() === itemText.trim().toLowerCase(),
  );
  if (!match) {
    const fuzzy = record.checklist.find((item) => item.item.toLowerCase().includes(itemText.toLowerCase()));
    if (!fuzzy) return '—';
    return fuzzy.completed ? '✓' : '—';
  }
  return match.completed ? '✓' : '—';
}

export function buildMaintenance008ATableRows(group: MaintenanceControlledFormGroup): string[][] {
  const byDay = new Map<number, MaintenanceRecord>();
  for (const record of group.records) {
    const dateStr = normalizeRecordDate(record.date);
    if (!dateStr) continue;
    const day = Number(dateStr.split('-')[2]);
    if (!Number.isNaN(day)) byDay.set(day, record);
  }

  const rows: string[][] = [];
  for (let day = 1; day <= 31; day += 1) {
    const record = byDay.get(day);
    if (!record) {
      rows.push([String(day), '—', '—', '—', '—', '—']);
      continue;
    }
    rows.push([
      String(day),
      checklistCompleted(record, 'Surface Cleaning'),
      checklistCompleted(record, 'Wash 5 Tubes'),
      checklistCompleted(record, 'Empty The Waste'),
      checklistCompleted(record, 'Fill D. Water Tank'),
      formatPrintInitials(record.performedByName, record.performedByStaffId),
    ]);
  }
  return rows;
}

export function groupMaintenanceRecordsForControlledPrint(
  records: MaintenanceRecord[],
  instrumentNames: Record<string, string>,
  instruments?: Record<string, Instrument>,
): { controlledGroups: MaintenanceControlledFormGroup[]; genericRecords: MaintenanceRecord[] } {
  const genericRecords: MaintenanceRecord[] = [];
  const bucket = new Map<string, MaintenanceRecord[]>();

  for (const record of records) {
    const instrumentName = instrumentNames[record.instrumentId] ?? record.instrumentId;
    const templateKey = resolveMaintenancePrintTemplateKey(instrumentName);
    if (templateKey !== 'hema-008a' || record.maintenanceType !== 'daily') {
      genericRecords.push(record);
      continue;
    }
    const dateStr = normalizeRecordDate(record.date);
    if (!dateStr) {
      genericRecords.push(record);
      continue;
    }
    const [yearStr, monthStr] = dateStr.split('-');
    const groupKey = `${record.instrumentId}|${yearStr}-${monthStr}`;
    const list = bucket.get(groupKey) ?? [];
    list.push(record);
    bucket.set(groupKey, list);
  }

  const controlledGroups: MaintenanceControlledFormGroup[] = [...bucket.entries()].map(([groupKey, groupRecords]) => {
    const [instrumentId, monthKey] = groupKey.split('|');
    const [yearStr, monthStr] = monthKey.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    return {
      templateKey: 'hema-008a' as const,
      instrumentId,
      instrumentName: instrumentNames[instrumentId] ?? instrumentId,
      year,
      month,
      monthLabel: formatMonthYearLabel(year, month),
      records: groupRecords.sort((a, b) => a.date.localeCompare(b.date)),
      instrument: instruments?.[instrumentId],
    };
  });

  return { controlledGroups, genericRecords };
}

export function formatMaintenanceProblemsSection(records: MaintenanceRecord[]): string {
  const lines = records
    .flatMap((record) => [record.issueFound, record.correctiveAction].filter(Boolean))
    .map((line) => line?.trim())
    .filter(Boolean) as string[];
  return lines.length > 0 ? lines.join('; ') : '—';
}
