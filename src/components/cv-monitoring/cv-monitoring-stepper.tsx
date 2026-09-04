'use client';

import { cn } from '@/lib/utils';

export type CvWizardStep = 'setup' | 'comparison' | 'review';

const STEPS: Array<{ id: CvWizardStep; label: string }> = [
  { id: 'setup', label: 'Setup' },
  { id: 'comparison', label: 'Comparison' },
  { id: 'review', label: 'Review' },
];

interface CvMonitoringStepperProps {
  current: CvWizardStep;
  className?: string;
}

export function CvMonitoringStepper({ current, className }: CvMonitoringStepperProps) {
  const currentIndex = STEPS.findIndex((step) => step.id === current);

  return (
    <ol className={cn('flex flex-wrap gap-2', className)}>
      {STEPS.map((step, index) => {
        const isActive = step.id === current;
        const isComplete = index < currentIndex;
        return (
          <li
            key={step.id}
            className={cn(
              'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
              isActive && 'border-primary bg-primary/10 text-primary',
              isComplete && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              !isActive && !isComplete && 'border-border text-muted-foreground',
            )}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-background text-[10px]">
              {index + 1}
            </span>
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}
