export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export function calculateRiskScore(likelihood: number, severity: number): number {
  const l = Math.min(Math.max(Math.round(likelihood), 1), 5);
  const s = Math.min(Math.max(Math.round(severity), 1), 5);
  return l * s;
}

export function getRiskLevel(score: number): RiskLevel {
  if (score >= 20) return 'critical';
  if (score >= 12) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
}

export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

export const REJECTION_REASONS = [
  'clotted',
  'hemolyzed',
  'insufficient_volume',
  'wrong_tube',
  'unlabeled',
  'mislabeled',
  'leaking',
  'delayed_transport',
  'improper_storage',
  'duplicate_sample',
  'other',
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const REJECTION_REASON_LABELS: Record<RejectionReason, { en: string; ar: string }> = {
  clotted: { en: 'Clotted', ar: 'متجلط' },
  hemolyzed: { en: 'Hemolyzed', ar: 'منحل الدم' },
  insufficient_volume: { en: 'Insufficient Volume', ar: 'حجم غير كافٍ' },
  wrong_tube: { en: 'Wrong Tube', ar: 'أنبوب خاطئ' },
  unlabeled: { en: 'Unlabeled', ar: 'بدون بطاقة' },
  mislabeled: { en: 'Mislabeled', ar: 'بطاقة خاطئة' },
  leaking: { en: 'Leaking', ar: 'تسرب' },
  delayed_transport: { en: 'Delayed Transport', ar: 'تأخر النقل' },
  improper_storage: { en: 'Improper Storage', ar: 'تخزين غير صحيح' },
  duplicate_sample: { en: 'Duplicate Sample', ar: 'عينة مكررة' },
  other: { en: 'Other', ar: 'أخرى' },
};
