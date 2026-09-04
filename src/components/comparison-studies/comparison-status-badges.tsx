import { Badge } from '@/components/ui/badge';
import type { ComparisonOverallResult, ComparisonResultStatus } from '@/types/comparison-study';

const RESULT_VARIANTS: Record<ComparisonResultStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  acceptable: 'default',
  not_acceptable: 'destructive',
  manual_review: 'secondary',
  incomplete: 'outline',
};

const OVERALL_VARIANTS: Record<ComparisonOverallResult, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  acceptable: 'default',
  not_acceptable: 'destructive',
  manual_review_required: 'secondary',
  incomplete: 'outline',
};

export function ComparisonResultStatusBadge({
  status,
  label,
}: {
  status: ComparisonResultStatus;
  label?: string;
}) {
  const display = label ?? status.replace(/_/g, ' ').toUpperCase();
  const className = status === 'acceptable'
    ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
    : status === 'manual_review'
      ? 'bg-amber-500 hover:bg-amber-500 text-white'
      : status === 'incomplete'
        ? 'bg-muted text-muted-foreground'
        : undefined;
  return (
    <Badge variant={RESULT_VARIANTS[status]} className={className}>
      {display}
    </Badge>
  );
}

export function ComparisonOverallResultBadge({ result }: { result?: ComparisonOverallResult }) {
  if (!result) return <Badge variant="outline">INCOMPLETE</Badge>;
  const label = result.replace(/_/g, ' ').toUpperCase();
  const className = result === 'acceptable'
    ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
    : result === 'manual_review_required'
      ? 'bg-amber-500 hover:bg-amber-500 text-white'
      : result === 'incomplete'
        ? 'bg-muted text-muted-foreground'
        : undefined;
  return (
    <Badge variant={OVERALL_VARIANTS[result]} className={className}>
      {label}
    </Badge>
  );
}
