import type { Permission } from '@/lib/permissions/roles';

export interface CommandCenterNavItem {
  id: string;
  href: string;
  labelKey: string;
  icon: string;
  permission?: Permission;
  permissions?: Permission[];
}

export interface CommandCenterNavGroup {
  id: string;
  labelKey: string;
  items: CommandCenterNavItem[];
}

function navItem(
  id: string,
  href: string,
  labelKey: string,
  icon: string,
  permission?: Permission,
  permissions?: Permission[],
): CommandCenterNavItem {
  return { id, href, labelKey, icon, permission, permissions };
}

/** Dashboard shell navigation — maps to existing routes; filtered by RBAC in sidebar. */
export const COMMAND_CENTER_NAV_GROUPS: CommandCenterNavGroup[] = [
  {
    id: 'grp-command',
    labelKey: 'navGroupCommandCenter',
    items: [
      navItem('nav-dashboard', '/dashboard', 'navCommandCenter', 'LayoutDashboard'),
      navItem('nav-review-center', '/review-center', 'reviewCenter', 'ClipboardCheck', 'tasks.review'),
      navItem('nav-approval-center', '/approval-center', 'approvalCenter', 'ShieldCheck', 'tasks.approve'),
    ],
  },
  {
    id: 'grp-overview',
    labelKey: 'navGroupOverview',
    items: [
      navItem('nav-dashboard-overview', '/dashboard', 'dashboard', 'LayoutDashboard'),
      navItem('nav-tasks', '/tasks', 'tasks', 'CheckSquare', 'tasks.view'),
      navItem('nav-review-center', '/review-center', 'reviewCenter', 'ClipboardCheck', 'tasks.review'),
      navItem('nav-approval-center', '/approval-center', 'approvalCenter', 'ShieldCheck', 'tasks.approve'),
      navItem('nav-calendar', '/calendar', 'calendar', 'Calendar', 'calendar.view'),
      navItem('nav-announcements', '/announcements', 'announcements', 'Megaphone', 'announcements.view'),
    ],
  },
  {
    id: 'grp-quality',
    labelKey: 'moduleQuality',
    items: [
      navItem('nav-qc', '/quality-control', 'qualityControl', 'FlaskConical', 'qc.view'),
      navItem('nav-cv-monitoring', '/quality/cv-monitoring', 'cvMonitoring', 'LineChart', 'cv_monitoring.view'),
      navItem('nav-comparison-studies', '/quality/comparison-studies', 'comparisonStudies', 'GitCompare', 'comparison.view'),
      navItem('nav-environmental', '/environmental-monitoring', 'environmentalMonitoring', 'Thermometer', 'environmental.view'),
      navItem('nav-qc-corrective', '/quality-control/corrective-actions', 'qcCorrectiveActions', 'ClipboardCheck', 'qc_corrective.view'),
    ],
  },
  {
    id: 'grp-operations',
    labelKey: 'moduleOperations',
    items: [
      navItem('nav-rejections', '/sample-rejections', 'sampleRejections', 'TestTube2', 'sample_rejections.view'),
      navItem('nav-critical', '/critical-values', 'criticalValues', 'AlertTriangle', 'critical_values.view'),
      navItem('nav-ppm-calibration', '/ppm-calibration', 'ppmCalibration', 'Gauge', 'ppm_calibration.view'),
      navItem('nav-maintenance', '/maintenance', 'maintenance', 'Wrench', 'maintenance.view'),
      navItem('nav-inventory', '/inventory', 'inventory', 'Package', 'inventory.view'),
    ],
  },
  {
    id: 'grp-documents',
    labelKey: 'moduleElectronicDocs',
    items: [
      navItem('nav-documents', '/documents', 'documents', 'FileText', 'documents.view'),
      navItem('nav-doclib', '/document-library', 'documentLibrary', 'FolderOpen', 'documents.view'),
      navItem('nav-fillable-forms', '/fillable-forms', 'fillableForms', 'FileType', 'forms.view'),
      navItem('nav-electronic-forms', '/electronic-forms', 'electronicForms', 'FileCheck', 'forms.view'),
    ],
  },
  {
    id: 'grp-staff-education',
    labelKey: 'navGroupStaffEducation',
    items: [
      navItem('nav-employees', '/employees', 'employees', 'BadgeCheck', 'employees.view'),
      navItem('nav-training', '/training', 'training', 'GraduationCap', 'training.view'),
    ],
  },
  {
    id: 'grp-administration',
    labelKey: 'moduleAdministration',
    items: [
      navItem('nav-reports', '/reports', 'reports', 'BarChart3', 'reports.view'),
      navItem('nav-instruments', '/instruments', 'instruments', 'Microscope', 'instruments.view'),
      navItem('nav-medical-reports', '/medical-reports', 'medicalReports', 'FileHeart', 'medical_reports.view'),
      navItem('nav-settings', '/settings', 'settings', 'Sliders', 'settings.manage'),
      navItem('nav-administration', '/administration', 'administration', 'Settings2', 'settings.manage'),
    ],
  },
];

export function filterCommandCenterNav(
  can: (permission: Permission) => boolean,
): CommandCenterNavGroup[] {
  return COMMAND_CENTER_NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.permissions?.length) {
          return item.permissions.some((p) => can(p));
        }
        if (item.permission) return can(item.permission);
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);
}

/** Flat navigation pages for command palette (deduped by href). */
export function getCommandPalettePages(
  can: (permission: Permission) => boolean,
  locale: string,
): Array<{ id: string; title: string; href: string; group: string }> {
  const seen = new Set<string>();
  const pages: Array<{ id: string; title: string; href: string; group: string }> = [];

  for (const group of filterCommandCenterNav(can)) {
    for (const item of group.items) {
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      pages.push({
        id: item.id,
        title: item.labelKey,
        href: `/${locale}${item.href}`,
        group: group.labelKey,
      });
    }
  }

  return pages;
}
