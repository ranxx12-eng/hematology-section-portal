import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MiniSparkline } from '@/components/dashboard/mini-sparkline';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  href?: string;
  trend?: { value: number; label: string };
  sparkline?: number[];
  sparklineColor?: string;
  className?: string;
  unavailable?: boolean;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClassName,
  href,
  trend,
  sparkline,
  sparklineColor = 'var(--primary)',
  className,
  unavailable,
}: MetricCardProps) {
  const content = (
    <div
      className={cn(
        'rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-shadow hover:shadow-md',
        href && 'cursor-pointer',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className={cn('mt-1 text-2xl font-semibold tabular-nums', unavailable && 'text-muted-foreground text-base')}>
            {value}
          </p>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p className={cn('mt-1 text-xs', trend.value >= 0 ? 'text-destructive' : 'text-success')}>
              {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn('rounded-xl p-2.5 shrink-0', iconClassName ?? 'bg-primary/10 text-primary')}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        )}
      </div>
      {sparkline && sparkline.length > 1 && (
        <div className="mt-3">
          <MiniSparkline data={sparkline} color={sparklineColor} />
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }

  return content;
}
