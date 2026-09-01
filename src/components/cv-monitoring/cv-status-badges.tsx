import { Badge } from '@/components/ui/badge';
import type { CvOverallStatus, CvResultStatus } from '@/types/cv-monitoring';

const RESULT_VARIANTS: Record<CvResultStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ok: 'default',
  high_cv: 'destructive',
  manual_review: 'secondary',
  incomplete: 'outline',
};

export function CvResultStatusBadge({ status }: { status: CvResultStatus }) {
  const label = status === 'high_cv' ? 'HIGH CV' : status.replace(/_/g, ' ').toUpperCase();
  const className = status === 'ok'
    ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
    : status === 'manual_review'
      ? 'bg-amber-500 hover:bg-amber-500 text-white'
      : status === 'incomplete'
        ? 'bg-muted text-muted-foreground'
        : undefined;
  return <Badge variant={RESULT_VARIANTS[status]} className={className}>{label}</Badge>;
}

export function CvOverallStatusBadge({ status }: { status?: CvOverallStatus }) {
  if (!status) return <Badge variant="outline">INCOMPLETE</Badge>;
  const label = status.replace(/_/g, ' ').toUpperCase();
  const className = status === 'all_within_limit'
    ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
    : status === 'manual_review_required'
      ? 'bg-amber-500 hover:bg-amber-500 text-white'
      : status === 'incomplete'
        ? 'bg-muted text-muted-foreground'
        : undefined;
  return <Badge variant={status === 'high_cv_detected' ? 'destructive' : 'secondary'} className={className}>{label}</Badge>;
}
