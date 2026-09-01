import type {
  CentrifugePppCalibration,
  CentrifugePppCalibrationSample,
  CentrifugePppCalibrationStatus,
  CentrifugePppSampleResult,
} from '@/types/centrifuge-ppp-calibration';

export const PLT_ACCEPTANCE_THRESHOLD = 10.0;
export const PLT_UNIT = '×10³/µL';
export const CENTRIFUGE_PPP_SAMPLE_COUNT = 5;

export const FORM_HEMA_009_NUMBER = 'Form-Hema-009';
export const FORM_HEMA_009_TITLE = 'Centrifuge Calibration Verification for Platelet Poor Plasma';
export const FORM_HEMA_009_FOOTER = 'Form-Hema-009-Centrifuge Calibration Verification for Platelet Poor Plasma';
export const FORM_HEMA_009_QID = 'HMG/SAH/QID/9161';

export function calculatePltSampleResult(pltResult: number): CentrifugePppSampleResult {
  return pltResult <= PLT_ACCEPTANCE_THRESHOLD ? 'pass' : 'fail';
}

export function calculateOverallResult(samples: Pick<CentrifugePppCalibrationSample, 'calculatedResult'>[]): CentrifugePppSampleResult | undefined {
  const results = samples.map((s) => s.calculatedResult).filter(Boolean) as CentrifugePppSampleResult[];
  if (results.length !== CENTRIFUGE_PPP_SAMPLE_COUNT) return undefined;
  return results.every((r) => r === 'pass') ? 'pass' : 'fail';
}

export function isSampleComplete(sample: CentrifugePppCalibrationSample): boolean {
  return (
    sample.pltResult != null
    && sample.centrifugeSpeedRpm != null
    && sample.centrifugeTimeMinutes != null
    && sample.calculatedResult != null
    && Boolean(sample.evidencePath)
  );
}

export function areAllSamplesComplete(samples: CentrifugePppCalibrationSample[]): boolean {
  if (samples.length !== CENTRIFUGE_PPP_SAMPLE_COUNT) return false;
  return samples.every(isSampleComplete);
}

export function getFailedSamples(samples: CentrifugePppCalibrationSample[]): CentrifugePppCalibrationSample[] {
  return samples.filter((s) => s.calculatedResult === 'fail');
}

export function formatPltResult(value: number | undefined | null): string {
  if (value == null) return '—';
  return `${value} ${PLT_UNIT}`;
}

export function formatSampleLabel(sampleNumber: number): string {
  return `Sample ${String(sampleNumber).padStart(2, '0')}`;
}

export const CENTRIFUGE_PPP_STATUS_LABELS: Record<CentrifugePppCalibrationStatus, string> = {
  draft: 'Draft',
  completed: 'Completed',
  pending_review: 'Pending Review',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  failed: 'Failed',
};

export function getCentrifugePppDisplayStatus(calibration: Pick<CentrifugePppCalibration, 'status' | 'overallResult' | 'approvalStatus'>): string {
  if (calibration.status === 'approved') {
    return calibration.overallResult === 'fail' ? 'Failed' : 'Approved';
  }
  if (calibration.status === 'failed') return 'Failed';
  return CENTRIFUGE_PPP_STATUS_LABELS[calibration.status];
}

export function canEditCentrifugePppCalibration(status: CentrifugePppCalibrationStatus): boolean {
  return status === 'draft' || status === 'failed';
}

export function canSubmitCentrifugePppCalibration(
  calibration: Pick<CentrifugePppCalibration, 'status' | 'samples' | 'overallResult' | 'problem' | 'correctiveAction'>,
): { ok: boolean; reason?: string } {
  if (!canEditCentrifugePppCalibration(calibration.status)) {
    return { ok: false, reason: 'This calibration is no longer editable.' };
  }
  if (!areAllSamplesComplete(calibration.samples)) {
    return { ok: false, reason: 'All five samples must be complete with evidence before submission.' };
  }
  if (calibration.overallResult === 'fail') {
    if (!calibration.problem?.trim() || !calibration.correctiveAction?.trim()) {
      return { ok: false, reason: 'Problem and Corrective Action are required when any sample fails.' };
    }
  }
  return { ok: true };
}

export function buildEmptySamples(calibrationId: string): Omit<CentrifugePppCalibrationSample, 'createdAt' | 'updatedAt'>[] {
  return Array.from({ length: CENTRIFUGE_PPP_SAMPLE_COUNT }, (_, index) => ({
    id: '',
    calibrationId,
    sampleNumber: index + 1,
  }));
}
