export const ROLES = [
  'system_admin',
  'lab_director',
  'lab_manager',
  'head_of_section',
  'section_supervisor',
  'quality_officer',
  'education_coordinator',
  'inventory_officer',
  'team_leader',
  'senior_lab_technologist',
  'lab_technologist',
  'trainee',
  'read_only',
  // Legacy DB enum values — mapped at runtime
  'quality_link',
  'viewer',
] as const;

export type Role = (typeof ROLES)[number];

/** Canonical hospital roles (13). */
export const PRODUCTION_ROLES = [
  'system_admin',
  'lab_director',
  'lab_manager',
  'head_of_section',
  'section_supervisor',
  'quality_officer',
  'education_coordinator',
  'inventory_officer',
  'team_leader',
  'senior_lab_technologist',
  'lab_technologist',
  'trainee',
  'read_only',
] as const satisfies readonly Role[];

const LEGACY_ROLE_ALIASES: Partial<Record<Role, Role>> = {
  quality_link: 'quality_officer',
  viewer: 'read_only',
};

export function resolveRole(role: Role): Role {
  return LEGACY_ROLE_ALIASES[role] ?? role;
}

export const ROLE_LABELS: Record<Role, { en: string; ar: string }> = {
  system_admin: { en: 'System Admin', ar: 'مدير النظام' },
  lab_director: { en: 'Lab Director', ar: 'مدير المختبر' },
  lab_manager: { en: 'Lab Manager', ar: 'مدير المختبر التشغيلي' },
  head_of_section: { en: 'Head Section', ar: 'رئيس القسم' },
  section_supervisor: { en: 'Supervisor', ar: 'مشرف القسم' },
  quality_officer: { en: 'Quality Officer', ar: 'مسؤول الجودة' },
  education_coordinator: { en: 'Education Coordinator', ar: 'منسق التعليم' },
  inventory_officer: { en: 'Inventory Officer', ar: 'مسؤول المخزون' },
  team_leader: { en: 'Team Leader', ar: 'قائد الفريق' },
  senior_lab_technologist: { en: 'Senior Technologist', ar: 'فني مختبر أول' },
  lab_technologist: { en: 'Laboratory Technologist', ar: 'فني مختبر' },
  trainee: { en: 'Trainee', ar: 'متدرب' },
  read_only: { en: 'Read Only', ar: 'قراءة فقط' },
  quality_link: { en: 'Quality Officer', ar: 'مسؤول الجودة' },
  viewer: { en: 'Read Only', ar: 'قراءة فقط' },
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

const QUALITY_OFFICER_PERMISSIONS: Permission[] = [
  'qc.view', 'qc.manage', 'critical_values.view', 'critical_values.manage',
  'sample_rejections.view', 'sample_rejections.manage',
  'corrected_results.view', 'corrected_results.manage',
  'kpi.view', 'risk.view', 'risk.manage', 'capa.view', 'capa.manage',
  'documents.view', 'documents.manage', 'training.view', 'reports.view',
  'notifications.view', 'audit.view',
  'media.view', 'media.manage', 'forms.view', 'forms.manage',
  'announcements.view', 'announcements.manage', 'calendar.view', 'calendar.manage',
  'report_builder.view', 'report_builder.manage',
];

const READ_ONLY_PERMISSIONS: Permission[] = [
  'reports.view', 'employees.view', 'tasks.view', 'instruments.view',
  'maintenance.view', 'qc.view', 'training.view', 'documents.view',
  'inventory.view', 'meetings.view', 'notifications.view',
  'announcements.view', 'calendar.view', 'forms.view',
];

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
  quality_officer: QUALITY_OFFICER_PERMISSIONS,
  quality_link: QUALITY_OFFICER_PERMISSIONS,
  education_coordinator: [
    'training.view', 'training.manage', 'documents.view', 'documents.manage',
    'employees.view', 'tasks.view', 'meetings.view', 'notifications.view',
    'announcements.view', 'calendar.view', 'forms.view', 'forms.manage',
    'media.view', 'media.manage',
  ],
  inventory_officer: [
    'inventory.view', 'inventory.manage', 'documents.view', 'tasks.view',
    'notifications.view', 'reports.view', 'employees.view',
  ],
  team_leader: [
    'employees.view', 'tasks.view', 'tasks.manage', 'tasks.approve',
    'instruments.view', 'maintenance.view', 'qc.view',
    'critical_values.view', 'sample_rejections.view', 'training.view',
    'documents.view', 'inventory.view', 'notifications.view', 'calendar.view',
  ],
  senior_lab_technologist: [
    'tasks.view', 'tasks.manage', 'instruments.view', 'maintenance.view', 'maintenance.manage',
    'qc.view', 'qc.manage',
    'critical_values.view', 'critical_values.manage',
    'sample_rejections.view', 'sample_rejections.manage',
    'corrected_results.view', 'tat.view', 'training.view', 'documents.view',
    'inventory.view', 'notifications.view', 'calendar.view',
  ],
  lab_technologist: [
    'tasks.view', 'instruments.view', 'qc.view', 'qc.manage',
    'critical_values.view', 'critical_values.manage',
    'sample_rejections.view', 'sample_rejections.manage',
    'corrected_results.view', 'tat.view', 'training.view', 'documents.view',
    'notifications.view', 'announcements.view', 'calendar.view',
  ],
  trainee: [
    'tasks.view', 'training.view', 'documents.view', 'notifications.view',
    'announcements.view', 'calendar.view',
  ],
  read_only: READ_ONLY_PERMISSIONS,
  viewer: READ_ONLY_PERMISSIONS,
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const resolved = resolveRole(role);
  return ROLE_PERMISSIONS[resolved]?.includes(permission) ?? false;
}

export function canViewEvaluations(role: Role): boolean {
  const resolved = resolveRole(role);
  return ['system_admin', 'lab_director', 'lab_manager', 'head_of_section', 'section_supervisor'].includes(resolved);
}

export function canViewIndividualEvaluation(role: Role, viewerId: string, employeeId: string): boolean {
  if (canViewEvaluations(role)) return true;
  return viewerId === employeeId;
}
