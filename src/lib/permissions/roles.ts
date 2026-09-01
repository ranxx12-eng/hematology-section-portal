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
  | 'equipment.view'
  | 'equipment.manage'
  | 'ppm_calibration.view'
  | 'ppm_calibration.create'
  | 'ppm_calibration.edit'
  | 'ppm_calibration.review'
  | 'ppm_calibration.approve'
  | 'ppm_calibration.delete'
  | 'ppm_calibration.restore'
  | 'maintenance.view'
  | 'maintenance.manage'
  | 'maintenance.perform'
  | 'qc.view'
  | 'qc.manage'
  | 'qc.review_daily'
  | 'qc.review_monthly'
  | 'qc.approve'
  | 'critical_values.view'
  | 'critical_values.manage'
  | 'critical_values.review'
  | 'sample_rejections.view'
  | 'sample_rejections.manage'
  | 'sample_rejections.review'
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
  | 'forms.submit'
  | 'forms.build'
  | 'forms.publish'
  | 'forms.manage_responses'
  | 'forms.manage'
  | 'announcements.view'
  | 'announcements.manage'
  | 'calendar.view'
  | 'calendar.manage'
  | 'report_builder.view'
  | 'report_builder.manage'
  | 'cms.view'
  | 'cms.manage'
  | 'records.delete'
  | 'records.restore'
  | 'environmental.view'
  | 'environmental.record'
  | 'environmental.correct'
  | 'environmental.review'
  | 'environmental.resolve'
  | 'environmental.manage_assets'
  | 'environmental.audit'
  | 'environmental.void'
  | 'medical_reports.view'
  | 'medical_reports.create'
  | 'medical_reports.edit'
  | 'medical_reports.review'
  | 'medical_reports.approve'
  | 'medical_reports.print'
  | 'comparison.view'
  | 'comparison.create'
  | 'comparison.edit'
  | 'comparison.submit'
  | 'comparison.review'
  | 'comparison.approve'
  | 'comparison.manage_definitions'
  | 'comparison.export'
  | 'comparison.archive'
  | 'cv_monitoring.view'
  | 'cv_monitoring.create'
  | 'cv_monitoring.edit'
  | 'cv_monitoring.submit'
  | 'cv_monitoring.review'
  | 'cv_monitoring.approve'
  | 'cv_monitoring.manage_definitions'
  | 'cv_monitoring.export'
  | 'cv_monitoring.archive';

const QUALITY_OFFICER_PERMISSIONS: Permission[] = [
  'qc.view', 'qc.manage', 'critical_values.view', 'critical_values.manage', 'critical_values.review',
  'sample_rejections.view', 'sample_rejections.manage', 'sample_rejections.review',
  'corrected_results.view', 'corrected_results.manage',
  'kpi.view', 'kpi.manage', 'risk.view', 'risk.manage', 'capa.view', 'capa.manage',
  'documents.view', 'documents.manage', 'training.view', 'reports.view',
  'notifications.view', 'audit.view',
  'environmental.view', 'environmental.record', 'environmental.correct', 'environmental.review',
  'environmental.resolve', 'environmental.manage_assets', 'environmental.audit',
  'equipment.view', 'equipment.manage',
  'ppm_calibration.view', 'ppm_calibration.create', 'ppm_calibration.edit', 'ppm_calibration.review',
  'media.view', 'media.manage',
  'forms.view', 'forms.submit', 'forms.build', 'forms.publish', 'forms.manage_responses',
  'announcements.view', 'announcements.manage', 'calendar.view', 'calendar.manage',
  'report_builder.view', 'report_builder.manage',
  'cms.view', 'cms.manage',
  'medical_reports.view', 'medical_reports.print',
  'comparison.view', 'comparison.create', 'comparison.review', 'comparison.manage_definitions', 'comparison.export',
  'cv_monitoring.view', 'cv_monitoring.create', 'cv_monitoring.review', 'cv_monitoring.manage_definitions', 'cv_monitoring.export',
];

const READ_ONLY_PERMISSIONS: Permission[] = [
  'reports.view', 'employees.view', 'tasks.view', 'instruments.view', 'equipment.view', 'ppm_calibration.view',
  'maintenance.view', 'qc.view', 'environmental.view', 'training.view', 'documents.view',
  'inventory.view', 'meetings.view', 'notifications.view',
  'announcements.view', 'calendar.view', 'forms.view',
  'cms.view',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  system_admin: [
    'users.manage', 'roles.manage', 'settings.manage', 'audit.view',
    'reports.view', 'reports.approve', 'reports.manage', 'kpi.view', 'kpi.manage',
    'employees.view', 'employees.manage', 'employees.evaluate',
    'tasks.view', 'tasks.manage', 'tasks.approve',
    'instruments.view', 'instruments.manage',
    'maintenance.view', 'maintenance.manage',
    'qc.view', 'qc.manage', 'qc.review_daily', 'qc.review_monthly', 'qc.approve',
    'critical_values.view', 'critical_values.manage', 'critical_values.review',
    'sample_rejections.view', 'sample_rejections.manage', 'sample_rejections.review',
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
    'forms.view', 'forms.submit', 'forms.build', 'forms.publish', 'forms.manage_responses', 'forms.manage',
    'announcements.view', 'announcements.manage',
    'calendar.view', 'calendar.manage',
    'report_builder.view', 'report_builder.manage',
    'cms.view', 'cms.manage',
    'records.delete', 'records.restore',
    'equipment.view', 'equipment.manage',
    'ppm_calibration.view', 'ppm_calibration.create', 'ppm_calibration.edit',
    'ppm_calibration.review', 'ppm_calibration.approve', 'ppm_calibration.delete', 'ppm_calibration.restore',
    'environmental.view', 'environmental.record', 'environmental.correct', 'environmental.review',
    'environmental.resolve', 'environmental.manage_assets', 'environmental.audit', 'environmental.void',
    'medical_reports.view', 'medical_reports.create', 'medical_reports.edit', 'medical_reports.review',
    'medical_reports.approve', 'medical_reports.print',
    'comparison.view', 'comparison.create', 'comparison.edit', 'comparison.submit',
    'comparison.review', 'comparison.approve', 'comparison.manage_definitions',
    'comparison.export', 'comparison.archive',
    'cv_monitoring.view', 'cv_monitoring.create', 'cv_monitoring.edit', 'cv_monitoring.submit',
    'cv_monitoring.review', 'cv_monitoring.approve', 'cv_monitoring.manage_definitions',
    'cv_monitoring.export', 'cv_monitoring.archive',
  ],
  lab_director: [
    'reports.view', 'reports.approve', 'kpi.view', 'employees.view', 'employees.evaluate',
    'tasks.view', 'instruments.view', 'maintenance.view', 'qc.view',
    'equipment.view', 'ppm_calibration.view',
    'medical_reports.view',
    'comparison.view',
    'cv_monitoring.view',
    'critical_values.view', 'critical_values.review',
    'sample_rejections.view', 'sample_rejections.review',
    'corrected_results.view',
    'tat.view', 'training.view', 'documents.view', 'inventory.view',
    'meetings.view', 'risk.view', 'capa.view', 'notifications.view', 'audit.view',
    'media.view', 'forms.view', 'announcements.view', 'calendar.view', 'report_builder.view',
    'cms.view',
  ],
  lab_manager: [
    'reports.view', 'reports.manage', 'kpi.view', 'kpi.manage',
    'employees.view', 'employees.evaluate', 'tasks.view', 'tasks.manage',
    'instruments.view', 'maintenance.view', 'qc.view', 'environmental.view', 'environmental.audit',
    'equipment.view', 'ppm_calibration.view', 'ppm_calibration.review',
    'medical_reports.view',
    'comparison.view',
    'cv_monitoring.view',
    'critical_values.view', 'critical_values.review',
    'sample_rejections.view', 'sample_rejections.review',
    'corrected_results.view',
    'tat.view', 'training.view', 'documents.view', 'inventory.view',
    'meetings.view', 'risk.view', 'capa.view', 'notifications.view',
    'media.view', 'forms.view', 'forms.submit', 'forms.build', 'forms.publish', 'forms.manage_responses',
    'announcements.view', 'calendar.view', 'report_builder.view',
    'cms.view', 'cms.manage',
  ],
  head_of_section: [
    'reports.view', 'reports.manage', 'kpi.view', 'employees.view', 'employees.manage',
    'tasks.view', 'tasks.manage', 'tasks.approve',
    'instruments.view', 'maintenance.view', 'qc.view', 'environmental.view', 'environmental.audit',
    'equipment.view', 'ppm_calibration.view', 'ppm_calibration.review', 'ppm_calibration.approve',
    'medical_reports.view',
    'comparison.view', 'comparison.approve', 'comparison.export',
    'cv_monitoring.view', 'cv_monitoring.approve', 'cv_monitoring.export',
    'critical_values.view', 'critical_values.manage', 'critical_values.review',
    'sample_rejections.view', 'sample_rejections.manage', 'sample_rejections.review',
    'corrected_results.view', 'tat.view',
    'training.view', 'documents.view', 'inventory.view',
    'meetings.view', 'meetings.manage', 'risk.view', 'capa.view', 'notifications.view',
    'media.view', 'media.manage',
    'forms.view', 'forms.submit', 'forms.build', 'forms.publish', 'forms.manage_responses',
    'announcements.view', 'announcements.manage', 'calendar.view', 'calendar.manage',
    'report_builder.view', 'report_builder.manage',
    'cms.view', 'cms.manage',
  ],
  section_supervisor: [
    'employees.view', 'employees.manage', 'tasks.view', 'tasks.manage', 'tasks.approve',
    'instruments.view', 'instruments.manage', 'maintenance.view', 'maintenance.manage',
    'qc.view', 'qc.manage', 'qc.approve',
    'critical_values.view', 'critical_values.manage', 'critical_values.review',
    'sample_rejections.view', 'sample_rejections.manage', 'sample_rejections.review',
    'corrected_results.view', 'tat.view', 'training.view', 'documents.view',
    'inventory.view', 'meetings.view', 'notifications.view',
    'announcements.view', 'calendar.view',
    'forms.view', 'forms.submit', 'forms.build', 'forms.publish', 'forms.manage_responses',
    'cms.view',
    'environmental.view', 'environmental.record', 'environmental.review', 'environmental.resolve', 'environmental.audit',
    'equipment.view', 'ppm_calibration.view', 'ppm_calibration.review',
    'medical_reports.view', 'medical_reports.review', 'medical_reports.approve', 'medical_reports.print',
    'comparison.view', 'comparison.review', 'comparison.approve', 'comparison.export',
    'cv_monitoring.view', 'cv_monitoring.review', 'cv_monitoring.approve', 'cv_monitoring.export',
  ],
  quality_officer: [
    ...QUALITY_OFFICER_PERMISSIONS.filter((p) => !p.startsWith('qc.')),
    'qc.view', 'qc.manage', 'qc.review_daily', 'qc.review_monthly',
  ],
  quality_link: [
    ...QUALITY_OFFICER_PERMISSIONS.filter((p) => !p.startsWith('qc.')),
    'qc.view', 'qc.manage', 'qc.review_daily', 'qc.review_monthly',
  ],
  education_coordinator: [
    'training.view', 'training.manage', 'documents.view', 'documents.manage',
    'employees.view', 'tasks.view', 'meetings.view', 'notifications.view',
    'announcements.view', 'calendar.view',
    'forms.view', 'forms.submit', 'forms.build', 'forms.publish', 'forms.manage_responses',
    'media.view', 'media.manage', 'cms.view', 'cms.manage',
  ],
  inventory_officer: [
    'inventory.view', 'inventory.manage', 'documents.view', 'tasks.view',
    'notifications.view', 'reports.view', 'employees.view', 'cms.view',
  ],
  team_leader: [
    'employees.view', 'tasks.view', 'tasks.manage', 'tasks.approve',
    'instruments.view', 'maintenance.view', 'qc.view',
    'environmental.view', 'environmental.record', 'environmental.review', 'environmental.audit',
    'critical_values.view', 'sample_rejections.view', 'training.view',
    'documents.view', 'inventory.view', 'notifications.view', 'calendar.view', 'cms.view',
  ],
  senior_lab_technologist: [
    'tasks.view', 'tasks.manage', 'instruments.view', 'maintenance.view', 'maintenance.manage',
    'qc.view', 'qc.manage', 'qc.review_daily',
    'environmental.view', 'environmental.record', 'environmental.correct', 'environmental.review', 'environmental.resolve', 'environmental.audit',
    'equipment.view', 'ppm_calibration.view', 'ppm_calibration.create', 'ppm_calibration.review',
    'medical_reports.view', 'medical_reports.create', 'medical_reports.review', 'medical_reports.print',
    'comparison.view', 'comparison.create', 'comparison.submit', 'comparison.review', 'comparison.export',
    'cv_monitoring.view', 'cv_monitoring.create', 'cv_monitoring.submit', 'cv_monitoring.review', 'cv_monitoring.export',
    'sample_rejections.view', 'sample_rejections.manage',
    'corrected_results.view', 'tat.view', 'training.view', 'documents.view',
    'inventory.view', 'notifications.view', 'calendar.view',
    'forms.view', 'forms.submit',
    'cms.view',
  ],
  lab_technologist: [
    'tasks.view', 'instruments.view', 'maintenance.view', 'maintenance.perform', 'qc.view', 'qc.manage',
    'environmental.view', 'environmental.record', 'environmental.correct',
    'equipment.view', 'ppm_calibration.view', 'ppm_calibration.create',
    'medical_reports.view', 'medical_reports.create', 'medical_reports.edit',
    'comparison.view', 'comparison.create', 'comparison.edit', 'comparison.submit',
    'cv_monitoring.view', 'cv_monitoring.create', 'cv_monitoring.edit', 'cv_monitoring.submit',
    'critical_values.view', 'critical_values.manage',
    'sample_rejections.view', 'sample_rejections.manage',
    'corrected_results.view', 'tat.view', 'kpi.view', 'training.view', 'documents.view',
    'notifications.view', 'announcements.view', 'calendar.view',
    'forms.view', 'forms.submit',
    'cms.view',
  ],
  trainee: [
    'tasks.view', 'training.view', 'documents.view', 'notifications.view',
    'announcements.view', 'calendar.view', 'cms.view',
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
