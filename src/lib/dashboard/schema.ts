import type { DashboardWidget, DashboardWidgetType } from '@/types/modules';

export interface DashboardLayoutInput {
  widgets: DashboardWidget[];
}

export const ALL_DASHBOARD_WIDGET_TYPES: DashboardWidgetType[] = [
  'stats_critical', 'stats_rejections', 'stats_pending', 'stats_tasks',
  'tat_summary', 'quick_links', 'announcements', 'calendar', 'tasks_summary',
];
