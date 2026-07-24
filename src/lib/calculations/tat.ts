export type TATStatus = 'within_target' | 'near_breach' | 'breached';

export interface TATTargets {
  stat: number;
  routine: number;
  dDimer: number;
  er: number;
  icu: number;
}

export const DEFAULT_TAT_TARGETS: TATTargets = {
  stat: 60,
  routine: 240,
  dDimer: 60,
  er: 90,
  icu: 90,
};

export function calculateTATMinutes(receivedAt: Date, releasedAt: Date): number {
  return Math.round((releasedAt.getTime() - receivedAt.getTime()) / 60000);
}

export function getTATStatus(tatMinutes: number, targetMinutes: number): TATStatus {
  if (tatMinutes > targetMinutes) return 'breached';
  if (tatMinutes >= targetMinutes * 0.85) return 'near_breach';
  return 'within_target';
}

export function getTATPercentage(tatMinutes: number, targetMinutes: number): number {
  return Math.round((tatMinutes / targetMinutes) * 100);
}

export type KPIStatus = 'achieved' | 'at_risk' | 'not_achieved';

export function getKPIStatus(current: number, target: number, lowerIsBetter = true): KPIStatus {
  const ratio = lowerIsBetter ? target / current : current / target;
  if (ratio >= 1) return 'achieved';
  if (ratio >= 0.85) return 'at_risk';
  return 'not_achieved';
}

export function maskPatientId(patientId: string): string {
  if (patientId.length <= 4) return '****';
  return `${patientId.slice(0, 2)}${'*'.repeat(Math.max(patientId.length - 4, 2))}${patientId.slice(-2)}`;
}
