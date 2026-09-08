'use client';

import { useMemo, useState } from 'react';
import { Filter, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function countActiveFilterValues<T extends Record<string, unknown>>(
  values: T,
  defaults: T,
  options?: {
    ignoreKeys?: (keyof T)[];
    isActive?: (key: keyof T, value: unknown, defaultValue: unknown) => boolean;
  },
): number {
  const ignore = new Set(options?.ignoreKeys ?? []);
  return (Object.keys(values) as (keyof T)[]).reduce((count, key) => {
    if (ignore.has(key)) return count;
    const value = values[key];
    const defaultValue = defaults[key];
    const active = options?.isActive
      ? options.isActive(key, value, defaultValue)
      : value !== defaultValue && value !== '' && value !== 'all';
    return active ? count + 1 : count;
  }, 0);
}

interface CollapsibleFiltersProps {
  label?: string;
  activeCount: number;
  onClearAll?: () => void;
  children: React.ReactNode;
  className?: string;
  panelClassName?: string;
}

export function CollapsibleFilters({
  label = 'Filters',
  activeCount,
  onClearAll,
  children,
  className,
  panelClassName,
}: CollapsibleFiltersProps) {
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const triggerLabel = (
    <>
      <Filter className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
      {activeCount > 0 && (
        <Badge variant="default" className="rounded-full px-2 py-0 text-xs">
          {activeCount}
        </Badge>
      )}
    </>
  );

  const clearAllButton = activeCount > 0 && onClearAll ? (
    <Button type="button" variant="ghost" size="sm" onClick={onClearAll} className="gap-1">
      <X className="h-3.5 w-3.5" />
      Clear All
    </Button>
  ) : null;

  return (
    <>
      <div className="hidden md:block">
        <Popover open={desktopOpen} onOpenChange={setDesktopOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn('gap-2', className)}
              aria-label={`${label}${activeCount > 0 ? `, ${activeCount} active` : ''}`}
            >
              {triggerLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className={cn('max-h-[70vh] overflow-y-auto', panelClassName)}>
            <div className="flex items-center justify-between gap-2 pb-3 border-b mb-3">
              <div className="font-medium">{label}</div>
              {clearAllButton}
            </div>
            {children}
          </PopoverContent>
        </Popover>
      </div>

      <div className="md:hidden">
        <Button
          type="button"
          variant="outline"
          className={cn('gap-2 w-full sm:w-auto', className)}
          aria-label={`${label}${activeCount > 0 ? `, ${activeCount} active` : ''}`}
          onClick={() => setMobileOpen(true)}
        >
          {triggerLabel}
        </Button>
        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{label}</DialogTitle>
            </DialogHeader>
            {clearAllButton && <div className="flex justify-end">{clearAllButton}</div>}
            <div className={panelClassName}>{children}</div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
