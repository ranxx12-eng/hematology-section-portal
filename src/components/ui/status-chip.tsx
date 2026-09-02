import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { statusBadgeVariant } from '@/lib/page-utils';

const statusChipVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
        danger: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300',
        warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
        info: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
        neutral: 'border-border bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export type StatusChipVariant = NonNullable<VariantProps<typeof statusChipVariants>['variant']>;

export interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: StatusChipVariant;
  label: string;
}

export function StatusChip({ variant = 'neutral', label, className, ...props }: StatusChipProps) {
  return (
    <span className={cn(statusChipVariants({ variant }), className)} {...props}>
      {label}
    </span>
  );
}

/** Map workflow status strings to unified chip variants. */
export function statusToChipVariant(status: string): StatusChipVariant {
  const badge = statusBadgeVariant(status);
  switch (badge) {
    case 'success':
      return 'success';
    case 'destructive':
      return 'danger';
    case 'warning':
      return 'warning';
    case 'default':
      return 'info';
    default:
      return 'neutral';
  }
}

export function StatusChipFromStatus({ status, className }: { status: string; className?: string }) {
  return (
    <StatusChip
      variant={statusToChipVariant(status)}
      label={status.replace(/_/g, ' ')}
      className={className}
    />
  );
}
