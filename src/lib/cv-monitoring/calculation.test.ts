import { describe, expect, it } from 'vitest';
import { derivePreviousMonth } from '@/lib/cv-monitoring/constants';
import {
  calculateCvStatistics,
  deriveOverallStatus,
  deriveTrendStatus,
  recalculateResultRow,
  roundForDisplay,
} from '@/lib/cv-monitoring/calculation';
import type { CvMonitoringResult } from '@/types/cv-monitoring';

describe('calculateCvStatistics — Level N PT', () => {
  const limit = 7.627;

  it('Previous Mean 15.2 SD 0.51 → CV ≈ 3.36% OK', () => {
    const result = calculateCvStatistics({ mean: 15.2, sd: 0.51, cvLimit: limit });
    expect(result.cvPercent).toBeCloseTo(3.355, 2);
    expect(roundForDisplay(result.cvPercent!, 2)).toBe(3.36);
    expect(result.status).toBe('ok');
  });

  it('Current Mean 15.4 SD 0.47 → CV ≈ 3.05% OK', () => {
    const result = calculateCvStatistics({ mean: 15.4, sd: 0.47, cvLimit: limit });
    expect(result.cvPercent).toBeCloseTo(3.051, 2);
    expect(result.status).toBe('ok');
  });
});

describe('calculateCvStatistics — Level N PTT', () => {
  const limit = 7.971;

  it('Previous 34.8 / 1.04 and Current 35 / 1.02 are OK', () => {
    expect(calculateCvStatistics({ mean: 34.8, sd: 1.04, cvLimit: limit }).status).toBe('ok');
    expect(calculateCvStatistics({ mean: 35, sd: 1.02, cvLimit: limit }).status).toBe('ok');
  });
});

describe('calculateCvStatistics — Level N FIB', () => {
  const limit = 10.656;

  it('Previous 306 / 19.1 and Current 293 / 17.1 are OK', () => {
    expect(calculateCvStatistics({ mean: 306, sd: 19.1, cvLimit: limit }).status).toBe('ok');
    expect(calculateCvStatistics({ mean: 293, sd: 17.1, cvLimit: limit }).status).toBe('ok');
  });
});

describe('calculateCvStatistics — Level N D-D', () => {
  const limit = 33.33;

  it('Previous 0.3 / 0.03 and Current 0.32 / 0.038 are OK', () => {
    expect(calculateCvStatistics({ mean: 0.3, sd: 0.03, cvLimit: limit }).status).toBe('ok');
    expect(calculateCvStatistics({ mean: 0.32, sd: 0.038, cvLimit: limit }).status).toBe('ok');
  });
});

describe('calculateCvStatistics — Level P', () => {
  it('PT limit 11.194 — Previous 33.8/1.55 and Current 33.7/1.63 OK', () => {
    expect(calculateCvStatistics({ mean: 33.8, sd: 1.55, cvLimit: 11.194 }).status).toBe('ok');
    expect(calculateCvStatistics({ mean: 33.7, sd: 1.63, cvLimit: 11.194 }).status).toBe('ok');
  });

  it('PTT limit 7.576 — Previous 65.3/2.76 and Current 66.3/2.58 OK', () => {
    expect(calculateCvStatistics({ mean: 65.3, sd: 2.76, cvLimit: 7.576 }).status).toBe('ok');
    expect(calculateCvStatistics({ mean: 66.3, sd: 2.58, cvLimit: 7.576 }).status).toBe('ok');
  });

  it('FIB limit 9.615 — Previous 130/8.1 and Current 124/7 OK', () => {
    expect(calculateCvStatistics({ mean: 130, sd: 8.1, cvLimit: 9.615 }).status).toBe('ok');
    expect(calculateCvStatistics({ mean: 124, sd: 7, cvLimit: 9.615 }).status).toBe('ok');
  });

  it('D-D limit 9.756 — Previous 2.26/0.09 and Current 2.3/0.07 OK', () => {
    expect(calculateCvStatistics({ mean: 2.26, sd: 0.09, cvLimit: 9.756 }).status).toBe('ok');
    expect(calculateCvStatistics({ mean: 2.3, sd: 0.07, cvLimit: 9.756 }).status).toBe('ok');
  });
});

describe('status edge cases', () => {
  it('Mean 100 SD 5 → CV 5%', () => {
    const result = calculateCvStatistics({ mean: 100, sd: 5, cvLimit: 10 });
    expect(result.cvPercent).toBe(5);
    expect(result.status).toBe('ok');
  });

  it('CV = limit → OK', () => {
    const result = calculateCvStatistics({ mean: 10, sd: 1, cvLimit: 10 });
    expect(result.cvPercent).toBe(10);
    expect(result.status).toBe('ok');
  });

  it('CV > limit → HIGH CV', () => {
    const result = calculateCvStatistics({ mean: 10, sd: 1.01, cvLimit: 10 });
    expect(result.status).toBe('high_cv');
  });

  it('Mean = 0 → Manual Review', () => {
    const result = calculateCvStatistics({ mean: 0, sd: 2, cvLimit: 10 });
    expect(result.cvPercent).toBeNull();
    expect(result.status).toBe('manual_review');
  });

  it('Missing Mean/SD → Incomplete', () => {
    expect(calculateCvStatistics({ mean: null, sd: 1, cvLimit: 10 }).status).toBe('incomplete');
  });
});

describe('deriveTrendStatus', () => {
  it('detects improved/increased/no change', () => {
    expect(deriveTrendStatus(5, 4)).toBe('improved');
    expect(deriveTrendStatus(4, 5)).toBe('increased');
    expect(deriveTrendStatus(5, 5)).toBe('no_change');
  });
});

describe('deriveOverallStatus', () => {
  it('returns HIGH CV DETECTED when any current row is high', () => {
    const results = [
      { currentStatus: 'ok' },
      { currentStatus: 'high_cv' },
    ] as CvMonitoringResult[];
    expect(deriveOverallStatus(results)).toBe('high_cv_detected');
  });
});

describe('derivePreviousMonth', () => {
  it('January 2027 → December 2026', () => {
    expect(derivePreviousMonth(1, 2027)).toEqual({ month: 12, year: 2026 });
  });

  it('April 2026 → March 2026', () => {
    expect(derivePreviousMonth(4, 2026)).toEqual({ month: 3, year: 2026 });
  });
});

describe('recalculateResultRow', () => {
  it('computes month-to-month CV change', () => {
    const row = recalculateResultRow({
      previousMean: 15.2,
      previousSd: 0.51,
      currentMean: 15.4,
      currentSd: 0.47,
      cvLimitSnapshot: 7.627,
    });
    expect(row.previousStatus).toBe('ok');
    expect(row.currentStatus).toBe('ok');
    expect(row.trendStatus).toBe('improved');
    expect(row.cvChange).toBeDefined();
  });
});
