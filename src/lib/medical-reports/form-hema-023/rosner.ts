import {
  ROSNER_CANNOT_CALCULATE_TEXT,
  ROSNER_INCOMPLETE_TEXT,
  ROSNER_INHIBITOR_TEXT,
  ROSNER_NEUTRAL_TEXT,
} from '@/lib/medical-reports/form-hema-023/constants';

export type RosnerStatus = 'calculated' | 'incomplete' | 'cannot_calculate' | 'invalid';

export interface RosnerCalculation {
  status: RosnerStatus;
  index: string | null;
  interpretation: string;
}

interface ScaledDecimal {
  units: bigint;
  scale: number;
}

const ZERO = BigInt(0);
const TEN = BigInt(10);
const FIFTEEN = BigInt(15);
const HUNDRED = BigInt(100);

function parseDecimal(raw: string): ScaledDecimal | 'empty' | 'invalid' {
  const trimmed = raw.trim();
  if (!trimmed) return 'empty';
  const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) return 'invalid';
  const fraction = match[2] ?? '';
  const digits = `${match[1]}${fraction}`.replace(/^0+(?=\d)/, '');
  return { units: BigInt(digits), scale: fraction.length };
}

function scaleTo(value: ScaledDecimal, scale: number): bigint {
  return value.units * TEN ** BigInt(scale - value.scale);
}

export function compareRosnerToThreshold(index: string): -1 | 0 | 1 {
  const negative = index.startsWith('-');
  const body = negative ? index.slice(1) : index;
  const parsed = parseDecimal(body);
  if (parsed === 'empty' || parsed === 'invalid') {
    throw new Error('Invalid Rosner index');
  }
  const signed = negative ? -parsed.units : parsed.units;
  const threshold = FIFTEEN * TEN ** BigInt(parsed.scale);
  if (signed > threshold) return 1;
  if (signed < threshold) return -1;
  return 0;
}

export function formatRosnerIndexDisplay(index: string): string {
  const negative = index.startsWith('-');
  const body = negative ? index.slice(1) : index;
  const parsed = parseDecimal(body);
  if (parsed === 'empty' || parsed === 'invalid') return index;
  const [whole, fraction = ''] = body.split('.');
  const trimmedFraction = fraction.slice(0, 4).replace(/0+$/, '');
  const truncated = trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
  const shown = negative ? `-${truncated}` : truncated;
  if (compareRosnerToThreshold(index) !== compareRosnerToThreshold(shown)) return index;
  return shown;
}

function formatExactQuotient(numerator: bigint, denominator: bigint): string {
  if (denominator === ZERO) {
    throw new Error('Cannot Calculate');
  }
  const negative = numerator < ZERO;
  let remainder = negative ? -numerator : numerator;
  const whole = remainder / denominator;
  remainder %= denominator;
  let fraction = '';
  for (let digit = 0; digit < 20 && remainder !== ZERO; digit += 1) {
    remainder *= TEN;
    fraction += (remainder / denominator).toString();
    remainder %= denominator;
  }
  const text = fraction ? `${whole.toString()}.${fraction}` : whole.toString();
  return negative ? `-${text}` : text;
}

export function calculateRosnerIndex(
  patientRaw: string,
  nppRaw: string,
  mixRaw: string,
): RosnerCalculation {
  const patient = parseDecimal(patientRaw);
  const npp = parseDecimal(nppRaw);
  const mix = parseDecimal(mixRaw);
  if (patient === 'invalid' || npp === 'invalid' || mix === 'invalid') {
    return { status: 'invalid', index: null, interpretation: '' };
  }
  if (patient === 'empty' || npp === 'empty' || mix === 'empty') {
    return { status: 'incomplete', index: null, interpretation: ROSNER_INCOMPLETE_TEXT };
  }
  if (patient.units === ZERO) {
    return { status: 'cannot_calculate', index: null, interpretation: ROSNER_CANNOT_CALCULATE_TEXT };
  }
  if (npp.units === ZERO || mix.units === ZERO) {
    return { status: 'invalid', index: null, interpretation: '' };
  }

  const scale = Math.max(patient.scale, npp.scale, mix.scale);
  const patientUnits = scaleTo(patient, scale);
  const nppUnits = scaleTo(npp, scale);
  const mixUnits = scaleTo(mix, scale);
  const numerator = (mixUnits - nppUnits) * HUNDRED;
  const above = numerator > FIFTEEN * patientUnits;
  const index = formatExactQuotient(numerator, patientUnits);
  return {
    status: 'calculated',
    index,
    interpretation: above ? ROSNER_INHIBITOR_TEXT : ROSNER_NEUTRAL_TEXT,
  };
}
