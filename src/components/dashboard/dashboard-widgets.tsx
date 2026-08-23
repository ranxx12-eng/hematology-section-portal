'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  Archive,
  CheckSquare,
  FlaskConical,
  Hourglass,
  ShieldCheck,
  Wrench,
  XCircle,
} from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { DASHBOARD_WIDGETS } from '@/lib/dashboard/widget-registry';
import type { OperationalDashboardMetrics } from '@/lib/clinical/reports-data';
import type { DashboardWidgetType } from '@/types/modules';

interface DashboardWidgetsProps {
  enabledWidgets: DashboardWidgetType[];
  metrics: OperationalDashboardMetrics;
  locale: string;
}

const WIDGET_ICONS: Record<DashboardWidgetType, typeof AlertTriangle> = {
  quality_control: ShieldCheck,
  maintenance: Wrench,
  active_instruments: FlaskConical,
  tasks: CheckSquare,
  critical_values: AlertTriangle,
  sample_rejections: XCircle,
  need_to_discard_sample: Archive,
  pending_samples: Hourglass,
};

const WIDGET_ICON_CLASSES: Partial<Record<DashboardWidgetType, string>> = {
  quality_control: 'bg-primary/10 text-primary',
  maintenance: 'bg-warning/10 text-warning',
  active_instruments: 'bg-success/10 text-success',
  tasks: 'bg-primary/10 text-primary',
  critical_values: 'bg-destructive/10 text-destructive',
  sample_rejections: 'bg-warning/10 text-warning',
  need_to_discard_sample: 'bg-warning/10 text-warning',
  pending_samples: 'bg-accent/10 text-accent',
};

function metricValue(type: DashboardWidgetType, metrics: OperationalDashboardMetrics): number {
  switch (type) {
    case 'quality_control':
      return metrics.qualityControl;
    case 'maintenance':
      return metrics.maintenance;
    case 'active_instruments':
      return metrics.activeInstruments;
    case 'tasks':
      return metrics.tasks;
    case 'critical_values':
      return metrics.criticalValues;
    case 'sample_rejections':
      return metrics.sampleRejections;
    case 'need_to_discard_sample':
      return metrics.needToDiscardSample;
    case 'pending_samples':
      return metrics.pendingSamples;
  }
}

export function DashboardWidgets({ enabledWidgets, metrics, locale }: DashboardWidgetsProps) {
  if (enabledWidgets.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {enabledWidgets.map((type) => {
        const config = DASHBOARD_WIDGETS[type];
        const Icon = WIDGET_ICONS[type];
        const href = `/${locale}${config.href}`;

        return (
          <Link key={type} href={href} className="block transition-opacity hover:opacity-90">
            <StatCard
              title={config.label}
              value={metricValue(type, metrics)}
              icon={Icon}
              iconClassName={WIDGET_ICON_CLASSES[type]}
              className="h-full cursor-pointer"
            />
          </Link>
        );
      })}
    </div>
  );
}
