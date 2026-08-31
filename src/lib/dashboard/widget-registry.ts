import { generateId } from '@/lib/utils';
import type { DashboardWidget, DashboardWidgetType } from '@/types/modules';

export interface DashboardWidgetDefinition {
  label: string;
  href: string;
  description?: string;
}

export const DASHBOARD_WIDGETS: Record<DashboardWidgetType, DashboardWidgetDefinition> = {
  quality_control: {
    label: 'Quality Control',
    href: '/quality-control',
    description: 'QC records',
  },
  maintenance: {
    label: 'Maintenance',
    href: '/maintenance',
    description: 'Maintenance records',
  },
  active_instruments: {
    label: 'Active Instruments & Equipment',
    href: '/instruments',
    description: 'Operational instruments',
  },
  tasks: {
    label: 'Tasks',
    href: '/tasks',
    description: 'Open tasks',
  },
  critical_values: {
    label: 'Critical Values',
    href: '/critical-values',
  },
  sample_rejections: {
    label: 'Sample Rejections',
    href: '/sample-rejections',
  },
  need_to_discard_sample: {
    label: 'Need to Discard Sample',
    href: '/sample-rejections?discardStatus=discard_due',
  },
  pending_samples: {
    label: 'Pending Samples',
    href: '/pending-samples',
  },
};

export const DEFAULT_DASHBOARD_WIDGET_ORDER: DashboardWidgetType[] = [
  'quality_control',
  'maintenance',
  'active_instruments',
  'tasks',
  'critical_values',
  'sample_rejections',
  'need_to_discard_sample',
  'pending_samples',
];

export const ALL_DASHBOARD_WIDGET_TYPES: DashboardWidgetType[] = [...DEFAULT_DASHBOARD_WIDGET_ORDER];

export function isDashboardWidgetType(value: string): value is DashboardWidgetType {
  return ALL_DASHBOARD_WIDGET_TYPES.includes(value as DashboardWidgetType);
}

export function createDefaultDashboardWidgetLayout(): DashboardWidget[] {
  return DEFAULT_DASHBOARD_WIDGET_ORDER.map((type, index) => ({
    id: generateId(),
    type,
    w: 3,
    h: 1,
    x: 0,
    y: index,
  }));
}

export function getWidgetLabel(type: DashboardWidgetType): string {
  return DASHBOARD_WIDGETS[type].label;
}

export function normalizeDashboardWidgets(widgets: DashboardWidget[]): DashboardWidget[] {
  const seen = new Set<DashboardWidgetType>();
  const normalized: DashboardWidget[] = [];

  for (const widget of widgets) {
    if (!isDashboardWidgetType(widget.type) || seen.has(widget.type)) continue;
    seen.add(widget.type);
    normalized.push(widget);
  }

  return normalized.length > 0 ? normalized : createDefaultDashboardWidgetLayout();
}

export function widgetTypesFromLayout(widgets: DashboardWidget[]): DashboardWidgetType[] {
  return normalizeDashboardWidgets(widgets).map((widget) => widget.type);
}
