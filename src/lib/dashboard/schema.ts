import type { DashboardWidget } from '@/types/modules';
import { ALL_DASHBOARD_WIDGET_TYPES } from './widget-registry';

export interface DashboardLayoutInput {
  widgets: DashboardWidget[];
}

export { ALL_DASHBOARD_WIDGET_TYPES };
