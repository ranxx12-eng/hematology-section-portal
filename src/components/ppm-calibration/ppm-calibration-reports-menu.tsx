'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PpmCalibrationReportsMenuProps {
  onExportPpmDue: () => void;
  onExportCalibrationDue: () => void;
  onExportHistory: () => void;
  onPrint: () => void;
  className?: string;
}

export function PpmCalibrationReportsMenu({
  onExportPpmDue,
  onExportCalibrationDue,
  onExportHistory,
  onPrint,
  className,
}: PpmCalibrationReportsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const items = [
    { label: 'PPM Due Report', icon: Download, action: onExportPpmDue },
    { label: 'Calibration Due Report', icon: Download, action: onExportCalibrationDue },
    { label: 'Maintenance History', icon: Download, action: onExportHistory },
    { label: 'Print Current View', icon: Printer, action: onPrint },
  ] as const;

  return (
    <div ref={menuRef} className={cn('relative', className)}>
      <Button
        type="button"
        variant="outline"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Reports menu"
        onClick={() => setOpen((value) => !value)}
        className="w-full sm:w-auto"
      >
        Reports
        <ChevronDown className={cn('ms-2 h-4 w-4 transition-transform', open && 'rotate-180')} />
      </Button>
      {open && (
        <div
          role="menu"
          aria-label="Report actions"
          className="absolute end-0 z-50 mt-1 min-w-[220px] rounded-lg border bg-popover p-1 shadow-md"
        >
          {items.map(({ label, icon: Icon, action }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                action();
                setOpen(false);
              }}
            >
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
