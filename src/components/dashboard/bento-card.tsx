import { cn } from '@/lib/utils';

interface BentoCardProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  noPadding?: boolean;
}

export function BentoCard({
  title,
  subtitle,
  action,
  className,
  children,
  noPadding,
}: BentoCardProps) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-border/80 bg-card shadow-sm',
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div>
            {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn(!noPadding && 'p-5')}>{children}</div>
    </section>
  );
}
