'use client';

import { cn } from '@/lib/utils';

export interface StickyActionBarAction {
  id: string;
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost';
  disabled?: boolean;
  hidden?: boolean;
}

interface StickyActionBarProps {
  actions: StickyActionBarAction[];
  className?: string;
}

/**
 * Reusable sticky footer action bar for long controlled-form record pages.
 */
export function StickyActionBar({ actions, className }: StickyActionBarProps) {
  const visible = actions.filter((action) => !action.hidden);
  if (visible.length === 0) return null;

  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 -mx-6 mt-6 border-t border-border/80 bg-card/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        {visible.map((action) => {
          const classNames = cn(
            'inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors',
            action.variant === 'default' && 'bg-primary text-white hover:bg-primary/90',
            action.variant === 'secondary' && 'bg-muted text-foreground hover:bg-muted/80',
            action.variant === 'outline' && 'border border-border bg-background hover:bg-muted/50',
            action.variant === 'destructive' && 'bg-destructive text-white hover:bg-destructive/90',
            (!action.variant || action.variant === 'ghost') && 'hover:bg-muted/60',
            action.disabled && 'pointer-events-none opacity-50',
          );

          if (action.href) {
            return (
              <a key={action.id} href={action.href} className={classNames}>
                {action.label}
              </a>
            );
          }

          return (
            <button
              key={action.id}
              type="button"
              className={classNames}
              disabled={action.disabled}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
