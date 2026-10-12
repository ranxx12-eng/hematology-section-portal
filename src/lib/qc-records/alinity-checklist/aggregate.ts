import { getParametersForInstrument } from '@/lib/qc-records/config';
import { daysInMonth, isValidChecklistDay, riyadhDateParts } from '@/lib/qc-records/alinity-checklist/calendar';
import {
  HEMA_024_ACCEPT_MARKER,
  HEMA_024_REJECT_MARKER,
} from '@/lib/qc-records/alinity-checklist/constants';

export type RoutineRunSlot = 'run_1' | 'run_2';
export type RunMark = 'blank' | 'accept' | 'reject' | 'incomplete';

export interface ChecklistQcResult {
  id: string;
  instrumentId: string;
  parameter: string;
  level: string;
  recordedAt: string;
  qcStatus: 'IN' | 'OUT';
  qcBatchId?: string;
  correctiveActions: string[];
  correctiveActionComment?: string;
  correctiveActionOther?: string;
  resolutionStatus?: 'IN' | 'Still OUT' | 'Pending';
  performedByUserId?: string;
  performedByName?: string;
  performedByStaffId?: string;
  reviewStatus: 'Pending Review' | 'Reviewed';
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewedByStaffId?: string;
  comment?: string;
  qcFrequency?: 'daily' | 'monthly';
  approvalStatus?: string;
  actionAt?: string;
  actionByName?: string;
  actionByStaffId?: string;
  resolvedAt?: string;
  resolvedByName?: string;
  reviewedAt?: string;
  reviewDecision?: 'accept' | 'not_accept' | 'need_follow_up';
  reviewComment?: string;
  approvedByName?: string;
  approvedByStaffId?: string;
  approvedAt?: string;
  approvalDecision?: 'accept' | 'not_accept' | 'need_follow_up';
  approvalComment?: string;
  lotNumber?: string;
  expiryDate?: string;
}

export interface ChecklistRunLink {
  day: number;
  slot: RoutineRunSlot;
  qcBatchId: string;
}

export interface ChecklistCvAttestation {
  day: number;
  attestedByUserId?: string;
  attestedByName?: string;
  attestedByStaffId?: string;
  attestedAt?: string;
}

export interface StaffIdentity {
  key: string;
  fullName: string;
  staffId: string;
}

export interface DayRunCell {
  mark: RunMark;
  technicians: StaffIdentity[];
  correction: string;
  batchId?: string;
}

export interface ChecklistDay {
  day: number;
  run1: DayRunCell;
  run2: DayRunCell;
  qcCheck: boolean;
  seniors: StaffIdentity[];
  cvMonitoring: StaffIdentity | null;
}

export interface UnassignedRun {
  key: string;
  batchId?: string;
  linkable: boolean;
  recordedAt: string;
  parameterCount: number;
  outCount: number;
  technicians: StaffIdentity[];
}

export interface BuiltChecklist {
  days: ChecklistDay[];
  legend: Array<StaffIdentity & { code: string }>;
  unassigned: UnassignedRun[];
  aggregation: string;
}

export const ALINITY_RUN_AGGREGATION =
  'A linked QC batch is Accept only when every active Alinity parameter is present and every result in that batch is IN. Any OUT result is Reject. A later resolution or repeat does not change that Reject. A linked batch that is missing an active parameter and has no OUT result is incomplete, which is not Accept and is not a recorded blank. Control levels stored on the batch are part of that run; levels that were never saved in the batch are not invented. Batches without an explicit Run 1 or Run 2 association stay Unassigned.';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function alinityRequiredParameters(): readonly string[] {
  return getParametersForInstrument('Alinity HQ 1147').map((parameter) => parameter.name);
}

export function staffIdentity(input: {
  userId?: string;
  fullName?: string;
  staffId?: string;
}): StaffIdentity | null {
  const rawName = input.fullName?.trim() ?? '';
  const nameMissing = rawName.length === 0 || UUID_PATTERN.test(rawName);
  const staffId = input.staffId?.trim() ?? '';
  if (nameMissing && staffId.length === 0 && !input.userId) return null;
  const key = input.userId?.trim() || `${rawName}|${staffId}`;
  return {
    key,
    fullName: nameMissing ? 'Name not recorded' : rawName,
    staffId: staffId || 'Not recorded',
  };
}

function uniqueIdentities(people: Array<StaffIdentity | null>): StaffIdentity[] {
  const seen = new Set<string>();
  const result: StaffIdentity[] = [];
  for (const person of people) {
    if (!person || seen.has(person.key)) continue;
    seen.add(person.key);
    result.push(person);
  }
  return result;
}

function interpretBatch(results: ChecklistQcResult[], requiredParameters: readonly string[]): RunMark {
  if (results.length === 0) return 'incomplete';
  if (results.some((result) => result.qcStatus === 'OUT')) return 'reject';
  const present = new Set(results.map((result) => result.parameter));
  const missingParameter = requiredParameters.some((parameter) => !present.has(parameter));
  if (missingParameter) return 'incomplete';
  if (results.some((result) => result.qcStatus !== 'IN')) return 'incomplete';
  return 'accept';
}

function correctionText(results: ChecklistQcResult[]): string {
  const corrected = results.filter((result) => (
    result.correctiveActions.length > 0
    || Boolean(result.correctiveActionComment?.trim())
    || Boolean(result.correctiveActionOther?.trim())
    || Boolean(result.resolutionStatus)
  ));
  if (corrected.length === 0) return '';
  const parts = new Set<string>();
  for (const result of corrected) {
    if (result.resolutionStatus) parts.add(result.resolutionStatus);
    else parts.add('Recorded');
  }
  return [...parts].join(', ');
}

function emptyRun(): DayRunCell {
  return { mark: 'blank', technicians: [], correction: '' };
}

function runCell(
  batchId: string | undefined,
  records: ChecklistQcResult[],
  requiredParameters: readonly string[],
): DayRunCell {
  if (!batchId) return emptyRun();
  const results = records.filter((record) => record.qcBatchId === batchId);
  return {
    mark: interpretBatch(results, requiredParameters),
    technicians: uniqueIdentities(results.map((result) => staffIdentity({
      userId: result.performedByUserId,
      fullName: result.performedByName,
      staffId: result.performedByStaffId,
    }))),
    correction: correctionText(results),
    batchId,
  };
}

function assignCodes(days: ChecklistDay[]): Array<StaffIdentity & { code: string }> {
  const ordered: StaffIdentity[] = [];
  const seen = new Set<string>();
  const push = (person: StaffIdentity | null) => {
    if (!person || seen.has(person.key)) return;
    seen.add(person.key);
    ordered.push(person);
  };
  for (const day of days) {
    day.run1.technicians.forEach(push);
    day.run2.technicians.forEach(push);
    day.seniors.forEach(push);
    push(day.cvMonitoring);
  }
  return ordered.map((person, index) => ({ ...person, code: identityCode(index) }));
}

export function identityCode(index: number): string {
  let value = index;
  let code = '';
  do {
    code = String.fromCharCode(65 + (value % 26)) + code;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return code;
}

export function codeFor(legend: Array<StaffIdentity & { code: string }>, person: StaffIdentity): string {
  return legend.find((entry) => entry.key === person.key)?.code ?? '';
}

export function buildAlinityChecklist(input: {
  year: number;
  month: number;
  links: ChecklistRunLink[];
  records: ChecklistQcResult[];
  attestations: ChecklistCvAttestation[];
  requiredParameters?: readonly string[];
}): BuiltChecklist {
  const requiredParameters = input.requiredParameters ?? alinityRequiredParameters();
  const monthRecords = input.records.filter((record) => {
    const parts = riyadhDateParts(record.recordedAt);
    return parts.year === input.year && parts.month === input.month;
  });
  const linkBySlot = new Map<string, string>();
  for (const link of input.links) {
    if (!isValidChecklistDay(input.year, input.month, link.day)) continue;
    linkBySlot.set(`${link.day}:${link.slot}`, link.qcBatchId);
  }
  const attestationByDay = new Map(input.attestations.map((attestation) => [attestation.day, attestation]));
  const lastDay = daysInMonth(input.year, input.month);
  const days: ChecklistDay[] = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const run1 = runCell(linkBySlot.get(`${day}:run_1`), monthRecords, requiredParameters);
    const run2 = runCell(linkBySlot.get(`${day}:run_2`), monthRecords, requiredParameters);
    const recorded = [
      ...(run1.batchId ? monthRecords.filter((record) => record.qcBatchId === run1.batchId) : []),
      ...(run2.batchId ? monthRecords.filter((record) => record.qcBatchId === run2.batchId) : []),
    ];
    const reviewed = recorded.length > 0 && recorded.every((record) => (
      record.reviewStatus === 'Reviewed' && Boolean(record.reviewedByName?.trim()) && Boolean(record.reviewedByUserId)
    ));
    const seniors = reviewed
      ? uniqueIdentities(recorded.map((record) => staffIdentity({
        userId: record.reviewedByUserId,
        fullName: record.reviewedByName,
        staffId: record.reviewedByStaffId,
      })))
      : [];
    const attestation = attestationByDay.get(day);
    const cvMonitoring = attestation
      ? staffIdentity({
        userId: attestation.attestedByUserId,
        fullName: attestation.attestedByName,
        staffId: attestation.attestedByStaffId,
      })
      : null;
    days.push({
      day,
      run1,
      run2,
      qcCheck: reviewed,
      seniors,
      cvMonitoring,
    });
  }

  const linkedBatches = new Set(input.links.map((link) => link.qcBatchId));
  const groups = new Map<string, ChecklistQcResult[]>();
  for (const record of monthRecords) {
    if (record.qcBatchId && linkedBatches.has(record.qcBatchId)) continue;
    const key = record.qcBatchId ?? `record:${record.id}`;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  const unassigned: UnassignedRun[] = [...groups.entries()].map(([key, results]) => ({
    key,
    batchId: results[0]?.qcBatchId,
    linkable: Boolean(results[0]?.qcBatchId),
    recordedAt: results[0]?.recordedAt ?? '',
    parameterCount: new Set(results.map((result) => result.parameter)).size,
    outCount: results.filter((result) => result.qcStatus === 'OUT').length,
    technicians: uniqueIdentities(results.map((result) => staffIdentity({
      userId: result.performedByUserId,
      fullName: result.performedByName,
      staffId: result.performedByStaffId,
    }))),
  }));

  return {
    days,
    legend: assignCodes(days),
    unassigned,
    aggregation: ALINITY_RUN_AGGREGATION,
  };
}

export function runMarkMarker(mark: RunMark): string {
  switch (mark) {
    case 'accept':
      return HEMA_024_ACCEPT_MARKER;
    case 'reject':
      return HEMA_024_REJECT_MARKER;
    case 'incomplete':
      return 'Inc';
    case 'blank':
      return '';
    default: {
      const unreachable: never = mark;
      return unreachable;
    }
  }
}

export function formatIdentityCodes(
  people: StaffIdentity[],
  legend: Array<StaffIdentity & { code: string }>,
): string {
  return people.map((person) => codeFor(legend, person)).filter(Boolean).join(',');
}
