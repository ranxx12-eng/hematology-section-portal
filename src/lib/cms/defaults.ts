import { generateId } from '@/lib/utils';
import type { CmsAdminState, CmsPage, NavGroupConfig, DashboardWidgetConfig } from '@/types/cms-admin';
import type { Permission } from '@/lib/permissions/roles';

const now = new Date().toISOString();

function item(id: string, href: string, labelKey: string, icon: string, sortOrder: number, permission?: Permission, visible = true): NavGroupConfig['items'][0] {
  return { id, href, labelKey, icon, permission, visible, sortOrder };
}

export function createDefaultNavigation(): NavGroupConfig[] {
  return [
    {
      id: 'grp-dashboard', labelKey: 'moduleDashboard', icon: 'LayoutDashboard', sortOrder: 0, visible: true,
      items: [item('nav-dashboard', '/dashboard', 'dashboard', 'LayoutDashboard', 0)],
    },
    {
      id: 'grp-about', labelKey: 'moduleAbout', icon: 'Target', sortOrder: 1, visible: true,
      items: [
        item('nav-leadership', '/our-leadership', 'ourLeadership', 'Users2', 0),
        item('nav-mission', '/mission-vision', 'missionVision', 'Target', 1),
        item('nav-newsletter', '/weekly-newsletter', 'weeklyNewsletter', 'Newspaper', 2),
      ],
    },
    {
      id: 'grp-staff', labelKey: 'moduleStaff', icon: 'Users', sortOrder: 2, visible: true,
      items: [item('nav-employees', '/employees', 'employees', 'Users', 0, 'employees.view')],
    },
    {
      id: 'grp-quality', labelKey: 'moduleQuality', icon: 'AlertTriangle', sortOrder: 3, visible: true,
      items: [
        item('nav-critical', '/critical-values', 'criticalValues', 'AlertTriangle', 0, 'critical_values.view'),
        item('nav-rejections', '/sample-rejections', 'sampleRejections', 'XCircle', 1, 'sample_rejections.view'),
        item('nav-corrected', '/corrected-results', 'correctedResults', 'FileCheck', 2, 'corrected_results.view'),
        item('nav-qc', '/quality-control', 'qualityControl', 'FlaskConical', 3, 'qc.view'),
        item('nav-risk', '/risk-capa', 'riskCapa', 'Shield', 4, 'risk.view'),
      ],
    },
    {
      id: 'grp-operations', labelKey: 'moduleOperations', icon: 'Clock', sortOrder: 4, visible: true,
      items: [
        item('nav-pending', '/pending-samples', 'pendingSamples', 'Hourglass', 0, 'tat.view'),
        item('nav-tat', '/tat', 'tat', 'Clock', 1, 'tat.view'),
        item('nav-maintenance', '/maintenance', 'maintenance', 'Wrench', 2, 'maintenance.view'),
      ],
    },
    {
      id: 'grp-instruments', labelKey: 'moduleInstruments', icon: 'Microscope', sortOrder: 5, visible: true,
      items: [item('nav-instruments', '/instruments', 'instruments', 'Microscope', 0, 'instruments.view')],
    },
    {
      id: 'grp-docs', labelKey: 'moduleElectronicDocs', icon: 'FolderOpen', sortOrder: 6, visible: true,
      items: [
        item('nav-doclib', '/document-library', 'documentLibrary', 'FolderOpen', 0, 'documents.view'),
        item('nav-documents', '/documents', 'documents', 'FileText', 1, 'documents.view'),
        item('nav-media', '/media-library', 'mediaLibrary', 'Image', 2, 'media.view'),
        item('nav-forms', '/form-builder', 'formBuilder', 'ClipboardList', 3, 'forms.view'),
      ],
    },
    {
      id: 'grp-education', labelKey: 'moduleEducation', icon: 'GraduationCap', sortOrder: 7, visible: true,
      items: [item('nav-training', '/training', 'training', 'GraduationCap', 0, 'training.view')],
    },
    {
      id: 'grp-reference', labelKey: 'moduleReference', icon: 'BookOpen', sortOrder: 8, visible: true,
      items: [
        item('nav-inventory', '/inventory', 'inventory', 'Package', 0, 'inventory.view'),
        item('nav-search', '/search', 'search', 'Search', 1),
      ],
    },
    {
      id: 'grp-tasks', labelKey: 'moduleTasks', icon: 'CheckSquare', sortOrder: 9, visible: true,
      items: [
        item('nav-tasks', '/tasks', 'tasks', 'CheckSquare', 0, 'tasks.view'),
        item('nav-calendar', '/calendar', 'calendar', 'Calendar', 1, 'calendar.view'),
        item('nav-meetings', '/meetings', 'meetings', 'Calendar', 2, 'meetings.view'),
        item('nav-announcements', '/announcements', 'announcements', 'Megaphone', 3, 'announcements.view'),
      ],
    },
    {
      id: 'grp-reports', labelKey: 'moduleReports', icon: 'BarChart3', sortOrder: 10, visible: true,
      items: [
        item('nav-reports', '/reports', 'reports', 'BarChart3', 0, 'reports.view'),
        item('nav-report-builder', '/report-builder', 'reportBuilder', 'PieChart', 1, 'report_builder.view'),
      ],
    },
    {
      id: 'grp-ai', labelKey: 'moduleAI', icon: 'Bot', sortOrder: 11, visible: true,
      items: [item('nav-ai', '/ai-assistant', 'aiAssistant', 'Bot', 0)],
    },
    {
      id: 'grp-admin', labelKey: 'moduleAdministration', icon: 'Settings2', sortOrder: 12, visible: true,
      items: [
        item('nav-notifications', '/notifications', 'notifications', 'Bell', 0, 'notifications.view'),
        item('nav-dashboard-custom', '/dashboard-customization', 'dashboardCustomization', 'LayoutGrid', 1, 'settings.manage'),
        item('nav-settings', '/settings', 'settings', 'Sliders', 2, 'settings.manage'),
        item('nav-audit', '/audit-log', 'auditCenter', 'Shield', 3, 'audit.view'),
        item('nav-administration', '/administration', 'administration', 'Settings2', 4, 'settings.manage'),
      ],
    },
  ];
}

export function createDefaultDashboardWidgets(): DashboardWidgetConfig[] {
  const types = [
    'stats_critical', 'stats_rejections', 'stats_pending', 'stats_tasks',
    'tat_summary', 'quick_links', 'announcements', 'calendar',
  ] as const;
  return types.map((type, i) => ({ type, enabled: true, sortOrder: i }));
}

export function createDefaultPages(): CmsPage[] {
  return [
    {
      id: 'page-home', title: 'Dashboard', slug: 'dashboard', moduleKey: 'dashboard', status: 'published', isVisible: true,
      blocks: [{ id: 'b1', type: 'hero', label: 'Hero Banner', content: 'Hematology Section Portal', sortOrder: 0 }],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'page-leadership', title: 'Our Leadership', slug: 'our-leadership', moduleKey: 'about', status: 'published', isVisible: true,
      blocks: [{ id: 'b1', type: 'text', label: 'Introduction', content: 'Meet our leadership team.', sortOrder: 0 }],
      createdAt: now, updatedAt: now,
    },
  ];
}

export function createDefaultCmsAdmin(): CmsAdminState {
  return {
    pages: createDefaultPages(),
    navigation: createDefaultNavigation(),
    dashboardWidgets: createDefaultDashboardWidgets(),
    homepage: {
      heroTitle: 'Central Laboratory',
      heroSubtitle: 'Hematology Section',
      showSpecialtyBadges: true,
      specialtyBadges: ['Coagulation', 'Hemostasis', 'Cellular Hematology'],
      showPhotoGallery: true,
    },
    branding: {
      appTitle: 'Hematology Section Portal',
      tagline: 'Internal management platform for the Hematology Laboratory Section',
      primaryColor: '#5B3FD6',
      secondaryColor: '#93C5FD',
      accentColor: '#38BDF8',
    },
  };
}

export function createEmptyPage(): CmsPage {
  return {
    id: generateId(),
    title: 'New Page',
    slug: 'new-page',
    moduleKey: 'custom',
    status: 'draft',
    isVisible: false,
    blocks: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createEmptyBlock(type: CmsPage['blocks'][0]['type'] = 'text'): CmsPage['blocks'][0] {
  return { id: generateId(), type, label: type.charAt(0).toUpperCase() + type.slice(1), content: '', sortOrder: 0 };
}
