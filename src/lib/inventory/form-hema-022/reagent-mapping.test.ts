import { describe, expect, it } from 'vitest';
import {
  resolveFormHema022Reagent,
  reagentRequiresManualCriteria,
} from '@/lib/inventory/form-hema-022/reagent-mapping';
import { FORM_HEMA_022_REAGENTS, FORM_HEMA_022_SAMPLE_COUNT } from '@/lib/inventory/form-hema-022/constants';
import { buildFormHema022ResultRows } from '@/lib/clinical/inventory-reagent-lot-form-hema-022';

describe('Form-Hema-022 reagent mapping', () => {
  it('maps every controlled reagent including PLT panel and RETIC', () => {
    for (const reagent of FORM_HEMA_022_REAGENTS) {
      expect(resolveFormHema022Reagent(reagent.displayName)?.definition.key).toBe(reagent.key);
    }
  });

  it('maps WBC reagent to four CBC tests', () => {
    const resolved = resolveFormHema022Reagent('WBC reagent');
    expect(resolved?.definition.tests.map((test) => test.code)).toEqual(['WBC', 'RBC', 'HGB', 'PLT']);
  });

  it('creates three samples times selected tests result rows', () => {
    const resolved = resolveFormHema022Reagent('NeoPTimal');
    const rows = buildFormHema022ResultRows('study-1', resolved!.definition.tests);
    expect(rows).toHaveLength(FORM_HEMA_022_SAMPLE_COUNT);
  });

  it('creates twelve rows for four-test reagents', () => {
    const resolved = resolveFormHema022Reagent('Diluent reagent');
    const rows = buildFormHema022ResultRows('study-1', resolved!.definition.tests);
    expect(rows).toHaveLength(FORM_HEMA_022_SAMPLE_COUNT * 4);
  });

  it('configures RETIC reagent with 25% TAE for both tests across three samples', () => {
    const resolved = resolveFormHema022Reagent('RETIC reagent');
    expect(reagentRequiresManualCriteria(resolved!.definition)).toBe(false);
    expect(resolved!.definition.tests).toEqual([
      expect.objectContaining({ code: 'RETIC', label: 'RETIC', acceptanceLimitPercent: 25, autoInterpretationEnabled: true }),
      expect.objectContaining({ code: 'R_PERCENT', label: 'R%', acceptanceLimitPercent: 25, autoInterpretationEnabled: true }),
    ]);
    const rows = buildFormHema022ResultRows('study-retic', resolved!.definition.tests);
    expect(rows).toHaveLength(FORM_HEMA_022_SAMPLE_COUNT * 2);
    expect(rows.every((row) => row.acceptance_limit_percent === 25)).toBe(true);
    expect(rows.every((row) => row.interpretation === 'incomplete')).toBe(true);
  });

  it('returns null for unmapped reagents', () => {
    expect(resolveFormHema022Reagent('Unknown reagent')).toBeNull();
  });

  it('changes test list when reagent mapping changes', () => {
    const pt = resolveFormHema022Reagent('NeoPTimal')!.definition.tests.map((test) => test.code);
    const ptt = resolveFormHema022Reagent('PTT A')!.definition.tests.map((test) => test.code);
    expect(pt).not.toEqual(ptt);
    expect(pt).toEqual(['PT']);
    expect(ptt).toEqual(['PTT']);
    expect(resolveFormHema022Reagent('NeoPTimal')!.definition.tests[0]?.label).toBe('PT Sec');
  });
});
