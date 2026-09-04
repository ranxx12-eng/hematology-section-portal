import { describe, expect, it } from 'vitest';
import {
  buildRunProgress,
  calculateCbcParameter,
  canSubmitCbcVerification,
  evaluateSdiAcceptance,
  isStudyVerifiedForUse,
} from '@/lib/qc-lot-verification/cbc-calculation';
import {
  CBC_RUN_DAYS,
  CBC_RUNS_PER_DAY,
  CBC_TOTAL_RUNS,
  CBC_VERIFICATION_PARAMETERS,
} from '@/lib/qc-lot-verification/constants';
import { buildQcVerificationContextKey } from '@/lib/qc-lot-verification/constants';
import type { QcLotVerificationParameter, QcLotVerificationRun } from '@/types/qc-lot-verification';

describe('CBC QC Lot Verification constants', () => {
  it('defines exactly 5 days and 4 runs per day', () => {
    expect(CBC_RUN_DAYS).toBe(5);
    expect(CBC_RUNS_PER_DAY).toBe(4);
    expect(CBC_TOTAL_RUNS).toBe(20);
  });

  it('defines exactly 26 CBC parameters', () => {
    expect(CBC_VERIFICATION_PARAMETERS).toHaveLength(26);
  });
});

describe('run progress', () => {
  const runs: QcLotVerificationRun[] = [];
  for (let day = 1; day <= 5; day += 1) {
    for (let run = 1; run <= 4; run += 1) {
      runs.push({
        id: `${day}-${run}`,
        studyId: 's1',
        dayNumber: day,
        runNumber: run,
        completed: day === 1 && run <= 4,
      });
    }
  }

  it('calculates progress percentage', () => {
    const progress = buildRunProgress(runs);
    expect(progress.completedRuns).toBe(4);
    expect(progress.percent).toBe(20);
    expect(progress.runsComplete).toBe(false);
  });

  it('marks complete at 20/20', () => {
    const allComplete = runs.map((r) => ({ ...r, completed: true }));
    const progress = buildRunProgress(allComplete);
    expect(progress.completedRuns).toBe(20);
    expect(progress.percent).toBe(100);
    expect(progress.runsComplete).toBe(true);
  });
});

describe('SDI acceptance', () => {
  it('passes when ABS(SDI) < 2', () => {
    expect(evaluateSdiAcceptance(1.99)).toBe('pass');
    expect(evaluateSdiAcceptance(-1.99)).toBe('pass');
    expect(evaluateSdiAcceptance(1.5)).toBe('pass');
    expect(evaluateSdiAcceptance(-1.5)).toBe('pass');
  });

  it('fails when ABS(SDI) >= 2', () => {
    expect(evaluateSdiAcceptance(2)).toBe('fail');
    expect(evaluateSdiAcceptance(-2)).toBe('fail');
    expect(evaluateSdiAcceptance(2.1)).toBe('fail');
    expect(evaluateSdiAcceptance(-2.1)).toBe('fail');
  });
});

describe('CBC parameter calculation', () => {
  it('calculates signed SDI and ranges', () => {
    const result = calculateCbcParameter({
      manufacturerMean: 10,
      manufacturerSd: 2,
      establishedMean: 7.1,
      establishedSd: 0.5,
    });
    expect(result.manufacturerLower).toBe(8);
    expect(result.manufacturerUpper).toBe(12);
    expect(result.establishedLower).toBe(6.1);
    expect(result.establishedUpper).toBe(8.1);
    expect(result.difference).toBeCloseTo(-2.9, 5);
    expect(result.sdi).toBeCloseTo(-1.45, 5);
    expect(result.result).toBe('pass');
  });

  it('returns manual review when manufacturer SD is zero', () => {
    const result = calculateCbcParameter({
      manufacturerMean: 10,
      manufacturerSd: 0,
      establishedMean: 10,
      establishedSd: 1,
    });
    expect(result.result).toBe('manual_review');
    expect(result.sdi).toBeUndefined();
    expect(result.manualReviewNote).toContain('Manufacturer SD is zero');
  });
});

describe('submit validation', () => {
  const completeRuns: QcLotVerificationRun[] = Array.from({ length: 20 }, (_, i) => ({
    id: String(i),
    studyId: 's1',
    dayNumber: Math.floor(i / 4) + 1,
    runNumber: (i % 4) + 1,
    completed: true,
  }));

  const completeParams: QcLotVerificationParameter[] = CBC_VERIFICATION_PARAMETERS.map((p, i) => ({
    id: String(i),
    studyId: 's1',
    parameterCode: p.code,
    parameterName: p.name,
    displayOrder: i + 1,
    manufacturerMean: 1,
    manufacturerSd: 0.1,
    establishedMean: 1,
    establishedSd: 0.1,
    result: 'pass',
  }));

  it('cannot submit before 20/20 runs', () => {
    const partial = completeRuns.map((r, i) => ({ ...r, completed: i < 10 }));
    const result = canSubmitCbcVerification(partial, completeParams);
    expect(result.ok).toBe(false);
  });

  it('can submit when runs and parameters complete', () => {
    const result = canSubmitCbcVerification(completeRuns, completeParams);
    expect(result.ok).toBe(true);
  });
});

describe('verification lookup identity', () => {
  it('builds context key with material, lot, instrument, and type', () => {
    const key = buildQcVerificationContextKey({
      verificationType: 'cbc',
      qcMaterialName: 'CBC Control',
      lotNumber: '12345',
      instrumentId: 'inst-1',
    });
    expect(key).toContain('type:cbc');
    expect(key).toContain('material:cbc control');
    expect(key).toContain('lot:12345');
    expect(key).toContain('instrument:inst-1');
  });

  it('counts approved acceptable study as verified', () => {
    expect(isStudyVerifiedForUse({
      status: 'approved',
      verificationType: 'cbc',
      finalDecision: 'verification_acceptable',
    })).toBe(true);
  });

  it('does not count rejected or draft as verified', () => {
    expect(isStudyVerifiedForUse({
      status: 'rejected',
      verificationType: 'cbc',
      finalDecision: 'verification_acceptable',
    })).toBe(false);
    expect(isStudyVerifiedForUse({
      status: 'draft',
      verificationType: 'cbc',
      finalDecision: 'verification_acceptable',
    })).toBe(false);
    expect(isStudyVerifiedForUse({
      status: 'approved',
      verificationType: 'cbc',
      finalDecision: 'verification_unacceptable_reject',
    })).toBe(false);
  });
});
