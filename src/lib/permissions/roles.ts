export const ROLES = [
  'system_admin',
  'lab_director',
  'lab_manager',
  'head_of_section',
  'section_supervisor',
  'quality_link',
  'senior_lab_technologist',
  'lab_technologist',
  'viewer',
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, { en: string; ar: string }> = {
  system_admin: { en: 'System Admin', ar: 'مدير النظام' },
  lab_director: { en: 'Lab Director', ar: 'مدير المختبر' },
  lab_manager: { en: 'Lab Manager', ar: 'مدير المختبر التشغيلي' },
  head_of_section: { en: 'Head of Section', ar: 'رئيس القسم' },
  section_supervisor: { en: 'Section Supervisor', ar: 'مشرف القسم' },
  quality_link: { en: 'Quality Link', ar: 'مسؤول الجودة' },
  senior_lab_technologist: { en: 'Senior Lab Technologist', ar: 'فني مختبر أول' },
  lab_technologist: { en: 'Lab Technologist', ar: 'فني مختبر' },
  viewer: { en: 'Viewer', ar: 'مشاهد' },
};

export type Permission =
  | 'users.manage'
  | 'roles.manage'
  | 'settings.manage'
  | 'audit.view'
  | 'reports.view'
  | 'reports.approve'
  | 'reports.manage'
  | 'kpi.view'
  | 'kpi.manage'
  | 'employees.view'
  | 'employees.manage'
  | 'employees.evaluate'
  | 'tasks.view'
  | 'tasks.manage'
  | 'tasks.approve'
  | 'instruments.view'
  | 'instruments.manage'
  | 'maintenance.view'
  | 'maintenance.manage'
  | 'qc.view'
  | 'qc.manage'
  | 'critical_values.view'
  | 'critical_values.manage'
  | 'sample_rejections.view'
  | 'sample_rejections.manage'
  | 'corrected_results.view'
  | 'corrected_results.manage'
  | 'tat.view'
  | 'tat.manage'
  | 'training.view'
  | 'training.manage'
  | 'documents.view'
  | 'documents.manage'
  | 'inventory.view'
  | 'inventory.manage'
  | 'meetings.view'
  | 'meetings.manage'
  | 'risk.view'
  | 'risk.manage'
  | 'capa.view'
  | 'capa.manage'
  | 'notifications.view'
  | 'notifications.manage'
  | 'media.view'
  | 'media.manage'
  | 'forms.view'
  | 'forms.manage'
  | 'announcements.view'
  | 'announcements.manage'
  | 'calendar.view'
  | 'calendar.manage'
  | 'report_builder.view'
  | 'report_builder.manage';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  system_admin: [
    'users.manage', 'roles.manage', 'settings.manage', 'audit.view',
    'reports.view', 'reports.approve', 'reports.manage', 'kpi.view', 'kpi.manage',
    'employees.view', 'employees.manage', 'employees.evaluate',
    'tasks.view', 'tasks.manage', 'tasks.approve',
    'instruments.view', 'instruments.manage',
    'maintenance.view', 'maintenance.manage',
    'qc.view', 'qc.manage',
    'critical_values.view', 'critical_values.manage',
    'sample_rejections.view', 'sample_rejections.manage',
    'corrected_results.view', 'corrected_results.manage',
    'tat.view', 'tat.manage',
    'training.view', 'training.manage',
    'documents.view', 'documents.manage',
    'inventory.view', 'inventory.manage',
    'meetings.view', 'meetings.manage',
    'risk.view', 'risk.manage',
    'capa.view', 'capa.manage',
    'notifications.view', 'notifications.manage',
    'media.view', 'media.manage',
    'forms.view', 'forms.manage',
    'announcements.view', 'announcements.manage',
    'calendar.view', 'calendar.manage',
    'report_builder.view', 'report_builder.manage',
  ],
  lab_director: [
    'reports.view', 'reports.approve', 'kpi.view', 'employees.view', 'employees.evaluate',
    'tasks.view', 'instruments.view', 'maintenance.view', 'qc.view',
    'critical_values.view', 'sample_rejections.view', 'corrected_results.view',
    'tat.view', 'training.view', 'documents.view', 'inventory.view',
    'meetings.view', 'risk.view', 'capa.view', 'notifications.view', 'audit.view',
    'media.view', 'forms.view', 'announcements.view', 'calendar.view', 'report_builder.view',
  ],
  lab_manager: [
    'reports.view', 'reports.manage', 'kpi.view', 'kpi.manage',
    'employees.view', 'employees.evaluate', 'tasks.view', 'tasks.manage',
    'instruments.view', 'maintenance.view', 'qc.view',
    'critical_values.view', 'sample_rejections.view', 'corrected_results.view',
    'tat.view', 'training.view', 'documents.view', 'inventory.view',
    'meetings.view', 'risk.view', 'capa.view', 'notifications.view',
    'media.view', 'forms.view', 'announcements.view', 'calendar.view', 'report_builder.view',
  ],
  head_of_section: [
    'reports.view', 'reports.manage', 'kpi.view', 'employees.view', 'employees.manage',
    'tasks.view', 'tasks.manage', 'tasks.approve',
    'instruments.view', 'maintenance.view', 'qc.view',
    'critical_values.view', 'sample_rejections.view', 'corrected_results.view',
    'tat.view', 'training.view', 'documents.view', 'inventory.view',
    'meetings.view', 'meetings.manage', 'risk.view', 'capa.view', 'notifications.view',
    'media.view', 'media.manage', 'forms.view', 'forms.manage',
    'announcements.view', 'announcements.manage', 'calendar.view', 'calendar.manage',
    'report_builder.view', 'report_builder.manage',
  ],
  section_supervisor: [
    'employees.view', 'employees.manage', 'tasks.view', 'tasks.manage', 'tasks.approve',
    'instruments.view', 'instruments.manage', 'maintenance.view', 'maintenance.manage',
    'qc.view', 'qc.manage', 'critical_values.view', 'sample_rejections.view',
    'corrected_results.view', 'tat.view', 'training.view', 'documents.view',
    'inventory.view', 'meetings.view', 'notifications.view',
    'announcements.view', 'calendar.view', 'forms.view',
  ],
  quality_link: [
    'qc.view', 'qc.manage', 'critical_values.view', 'critical_values.manage',
    'sample_rejections.view', 'sample_rejections.manage',
    'corrected_results.view', 'corrected_results.manage',
    'kpi.view', 'risk.view', 'risk.manage', 'capa.view', 'capa.manage',
    'documents.view', 'documents.manage', 'training.view', 'reports.view',
    'notifications.view', 'audit.view',
    'media.view', 'media.manage', 'forms.view', 'forms.manage',
    'announcements.view', 'announcements.manage', 'calendar.view', 'calendar.manage',
    'report_builder.view', 'report_builder.manage',
  ],
  senior_lab_technologist: [
    'tasks.view', 'tasks.manage', 'instruments.view', 'maintenance.view', 'maintenance.manage',
    'qc.view', 'qc.manage', 'critical_values.view', 'sample_rejections.view',
    'corrected_results.view', 'tat.view', 'training.view', 'documents.view',
    'inventory.view', 'notifications.view', 'calendar.view',
  ],
  lab_technologist: [
    'tasks.view', 'instruments.view', 'maintenance.view', 'qc.view',
    'critical_values.view', 'sample_rejections.view', 'corrected_results.view',
    'tat.view', 'training.view', 'documents.view', 'notifications.view',
    'announcements.view', 'calendar.view',
  ],
  viewer: [
    'reports.view', 'employees.view', 'tasks.view', 'instruments.view',
    'maintenance.view', 'qc.view', 'training.view', 'documents.view',
    'inventory.view', 'meetings.view', 'notifications.view',
    'announcements.view', 'calendar.view', 'forms.view',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canViewEvaluations(role: Role): boolean {
  return ['system_admin', 'lab_director', 'lab_manager', 'head_of_section', 'section_supervisor'].includes(role);
}

export function canViewIndividualEvaluation(role: Role, viewerId: string, employeeId: string): boolean {
  if (canViewEvaluations(role)) return true;
  return viewerId === employeeId;
}
