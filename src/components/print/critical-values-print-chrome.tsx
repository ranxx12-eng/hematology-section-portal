'use client';

import { OFFICIAL_HOSPITAL_LOGO_SRC } from '@/lib/portal/official-logo.constants';
import {
  CRITICAL_VALUES_LOG_DEPARTMENT,
  CRITICAL_VALUES_LOG_FOOTER_LEFT,
  CRITICAL_VALUES_LOG_FOOTER_RIGHT,
  CRITICAL_VALUES_LOG_HOSPITAL,
} from '@/lib/print/critical-values-report';

export function CriticalValuesPrintHeader() {
  return (
    <header className="critical-values-print-header hidden print:block mb-3">
      <div className="flex flex-col items-center text-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={OFFICIAL_HOSPITAL_LOGO_SRC}
          alt="Hospital Logo"
          className="h-14 w-auto max-w-[120px] object-contain"
        />
        <p className="text-base font-semibold text-foreground tracking-wide">{CRITICAL_VALUES_LOG_HOSPITAL}</p>
        <p className="text-sm text-foreground">{CRITICAL_VALUES_LOG_DEPARTMENT}</p>
      </div>
      <hr className="mt-3 border-t border-foreground/30" />
    </header>
  );
}

export function CriticalValuesPrintFooter() {
  return (
    <footer className="critical-values-print-footer hidden print:block">
      <hr className="mb-2 border-t border-foreground/30" />
      <div className="flex justify-between text-[9pt] text-foreground">
        <span>{CRITICAL_VALUES_LOG_FOOTER_LEFT}</span>
        <span>{CRITICAL_VALUES_LOG_FOOTER_RIGHT}</span>
      </div>
    </footer>
  );
}

export function CriticalValuesSupervisorReview() {
  return (
    <div className="critical-values-supervisor-review hidden print:block">
      <span className="critical-values-supervisor-label">Supervisor Review:</span>
      <span className="critical-values-supervisor-line" aria-hidden="true" />
    </div>
  );
}
