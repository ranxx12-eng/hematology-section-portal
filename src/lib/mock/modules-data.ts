import { generateId } from '@/lib/utils';
import type {
  MediaFolder, MediaAsset, DynamicForm, FormResponse, Announcement, CalendarEvent,
  LibraryDocument, DashboardLayout, ReportTemplate, NotificationPreference, ExtendedSettings,
} from '@/types/modules';

const now = new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
const daysFromNow = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

export function createMediaFolders(): MediaFolder[] {
  return [
    { id: 'folder-root', name: 'Root', createdAt: now },
    { id: 'folder-lab', name: 'Laboratory Photos', parentId: 'folder-root', createdAt: now },
    { id: 'folder-sops', name: 'SOP Attachments', parentId: 'folder-root', createdAt: now },
    { id: 'folder-training', name: 'Training Materials', parentId: 'folder-root', createdAt: now },
  ];
}

export function createMediaAssets(userId: string): MediaAsset[] {
  const items: Omit<MediaAsset, 'id' | 'createdAt' | 'updatedAt'>[] = [
    { name: 'Hospital Logo', folderId: 'folder-root', fileType: 'image', mimeType: 'image/svg+xml', sizeBytes: 12000, tags: ['branding', 'logo'], category: 'Branding', dataUrl: '/images/portal/hospital-logo.svg', usageCount: 4, usageLocations: ['Login', 'Sidebar', 'Dashboard', 'Header'], uploadedBy: userId },
    { name: 'Hematology Lab Photo', folderId: 'folder-lab', fileType: 'image', mimeType: 'image/svg+xml', sizeBytes: 18000, tags: ['lab', 'department'], category: 'Department', dataUrl: '/images/portal/hematology-lab.svg', usageCount: 2, usageLocations: ['Dashboard'], uploadedBy: userId },
    { name: 'QC Procedure SOP', folderId: 'folder-sops', fileType: 'pdf', mimeType: 'application/pdf', sizeBytes: 245000, tags: ['sop', 'qc'], category: 'SOPs', usageCount: 1, usageLocations: ['Document Library'], uploadedBy: userId },
    { name: 'Staff Training Deck', folderId: 'folder-training', fileType: 'powerpoint', mimeType: 'application/vnd.ms-powerpoint', sizeBytes: 890000, tags: ['training'], category: 'Training', usageCount: 0, usageLocations: [], uploadedBy: userId },
    { name: 'Maintenance Checklist', folderId: 'folder-sops', fileType: 'excel', mimeType: 'application/vnd.ms-excel', sizeBytes: 56000, tags: ['maintenance'], category: 'Forms', usageCount: 1, usageLocations: ['Maintenance Module'], uploadedBy: userId },
  ];
  return items.map((item) => ({ ...item, id: generateId(), createdAt: now, updatedAt: now }));
}

export function createDynamicForms(userId: string): DynamicForm[] {
  return [{
    id: 'form-001',
    title: 'Sample Incident Report',
    description: 'Report laboratory incidents and near-miss events',
    fields: [
      { id: 'f1', label: 'Reporter Name', type: 'text', required: true },
      { id: 'f2', label: 'Incident Date', type: 'date', required: true },
      { id: 'f3', label: 'Incident Time', type: 'time', required: true },
      { id: 'f4', label: 'Severity', type: 'dropdown', required: true, options: ['Low', 'Medium', 'High', 'Critical'] },
      { id: 'f5', label: 'Affected Area', type: 'radio', required: true, options: ['Pre-analytical', 'Analytical', 'Post-analytical'] },
      { id: 'f6', label: 'Follow-up Required', type: 'checkbox', required: false },
      { id: 'f7', label: 'Contact Email', type: 'email', required: true },
      { id: 'f8', label: 'Contact Phone', type: 'phone', required: false },
      { id: 'f9', label: 'Supporting Documents', type: 'file', required: false },
      { id: 'f10', label: 'Reporter Signature', type: 'signature', required: true },
    ],
    isPublished: true,
    createdBy: userId,
    createdAt: daysAgo(30),
    updatedAt: now,
  }];
}

export function createFormResponses(formId: string, userId: string): FormResponse[] {
  return [{
    id: 'resp-001',
    formId,
    submittedBy: userId,
    answers: {
      f1: 'Ahmed Al-Rashid',
      f2: daysAgo(2).slice(0, 10),
      f3: '14:30',
      f4: 'Medium',
      f5: 'Analytical',
      f6: true,
      f7: 'ahmed@hematology.local',
      f8: '+966500001005',
      f10: 'Signed',
    },
    submittedAt: daysAgo(2),
  }];
}

export function createAnnouncements(userId: string): Announcement[] {
  return [
    { id: 'ann-001', title: 'CBAHI Survey Preparation', content: '<p>All staff must complete readiness checklist by end of month.</p>', type: 'circular', priority: 'high', targetAudience: 'all', expiresAt: daysFromNow(14), isPinned: true, isPublished: true, authorId: userId, createdAt: daysAgo(1), updatedAt: now },
    { id: 'ann-002', title: 'Emergency: Reagent Supply Delay', content: '<p>PT reagent delivery delayed 24 hours. Use backup lot per SOP-HM-014.</p>', type: 'emergency', priority: 'critical', targetAudience: 'technologists', expiresAt: daysFromNow(1), isPinned: true, isPublished: true, authorId: userId, createdAt: daysAgo(0), updatedAt: now },
    { id: 'ann-003', title: 'Monthly Quality Meeting', content: '<p>Section quality meeting scheduled for next Tuesday at 10:00 AM.</p>', type: 'event', priority: 'normal', targetAudience: 'management', expiresAt: daysFromNow(7), isPinned: false, isPublished: true, authorId: userId, createdAt: daysAgo(3), updatedAt: now },
    { id: 'ann-004', title: 'New SOP Published', content: '<p>SOP-HM-022 Critical Value Notification updated to version 3.1.</p>', type: 'news', priority: 'normal', targetAudience: 'all', isPinned: false, isPublished: true, authorId: userId, createdAt: daysAgo(5), updatedAt: now },
  ];
}

export function createCalendarEvents(userId: string): CalendarEvent[] {
  const base = new Date();
  const month = base.getMonth();
  const year = base.getFullYear();
  const d = (day: number, h = 9) => new Date(year, month, day, h).toISOString();
  return [
    { id: 'cal-001', title: 'Section Quality Meeting', type: 'meeting', startDate: d(8, 10), endDate: d(8, 11), allDay: false, location: 'Conference Room B', createdBy: userId, createdAt: now },
    { id: 'cal-002', title: 'Hemostasis Training', type: 'training', startDate: d(12, 13), endDate: d(12, 15), allDay: false, location: 'Training Room', assignedTo: 'emp-005', createdBy: userId, createdAt: now },
    { id: 'cal-003', title: 'STA-R Max Preventive Maintenance', type: 'maintenance', startDate: d(15, 8), endDate: d(15, 12), allDay: false, location: 'Bench 2', createdBy: userId, createdAt: now },
    { id: 'cal-004', title: 'CAP Proficiency Review', type: 'cap_visit', startDate: d(20, 9), endDate: d(20, 17), allDay: true, location: 'Hematology Section', createdBy: userId, createdAt: now },
    { id: 'cal-005', title: 'CBAHI Internal Audit', type: 'cbahi', startDate: d(22, 9), endDate: d(24, 17), allDay: true, createdBy: userId, createdAt: now },
    { id: 'cal-006', title: 'National Day Holiday', type: 'holiday', startDate: d(23, 0), endDate: d(23, 23), allDay: true, createdBy: userId, createdAt: now },
    { id: 'cal-007', title: 'Morning Shift — Bench Coverage', type: 'staff_schedule', startDate: d(10, 7), endDate: d(10, 15), allDay: false, assignedTo: 'emp-004', createdBy: userId, createdAt: now },
  ];
}

export function createLibraryDocuments(ownerId: string): LibraryDocument[] {
  return [
    {
      id: 'libdoc-001', documentNumber: 'SOP-HM-001', title: 'Sample Collection and Handling', category: 'sop',
      currentVersion: '4.2', versions: [{ version: '4.2', fileName: 'SOP-HM-001-v4.2.pdf', uploadedBy: ownerId, uploadedAt: daysAgo(10), changeNotes: 'Updated rejection criteria' }],
      effectiveDate: daysAgo(10), expiryDate: daysFromNow(355), ownerId, status: 'approved',
      approvalWorkflow: [{ step: 'Author', approverId: ownerId, status: 'approved', date: daysAgo(12) }, { step: 'Quality Review', approverId: 'emp-003', status: 'approved', date: daysAgo(11) }],
      downloadHistory: [{ id: 'dl-001', documentId: 'libdoc-001', userId: 'emp-005', downloadedAt: daysAgo(2) }],
      createdAt: daysAgo(365), updatedAt: daysAgo(10),
    },
    {
      id: 'libdoc-002', documentNumber: 'POL-HM-003', title: 'Critical Value Notification Policy', category: 'policy',
      currentVersion: '2.0', versions: [{ version: '2.0', fileName: 'POL-HM-003-v2.0.pdf', uploadedBy: ownerId, uploadedAt: daysAgo(30) }],
      effectiveDate: daysAgo(30), expiryDate: daysFromNow(30), ownerId, status: 'approved',
      approvalWorkflow: [{ step: 'Lab Director', status: 'approved', date: daysAgo(31) }],
      downloadHistory: [], createdAt: daysAgo(200), updatedAt: daysAgo(30),
    },
    {
      id: 'libdoc-003', documentNumber: 'CAP-2025-Q1', title: 'CAP Proficiency Results Q1 2025', category: 'cap',
      currentVersion: '1.0', versions: [{ version: '1.0', fileName: 'CAP-Q1-2025.pdf', uploadedBy: ownerId, uploadedAt: daysAgo(60) }],
      effectiveDate: daysAgo(60), ownerId, status: 'approved', approvalWorkflow: [], downloadHistory: [],
      createdAt: daysAgo(60), updatedAt: daysAgo(60),
    },
  ];
}

export function createReportTemplates(userId: string): ReportTemplate[] {
  return [{
    id: 'rpt-001',
    name: 'Monthly Critical Values Summary',
    table: 'criticalValues',
    columns: ['date', 'patientName', 'test', 'criticalValue', 'department'],
    filters: [{ field: 'date', operator: 'this_month', value: '' }],
    chartType: 'bar',
    chartColumn: 'test',
    createdBy: userId,
    createdAt: daysAgo(7),
    updatedAt: now,
  }];
}

export function createDefaultDashboardLayout(userId: string): DashboardLayout {
  return {
    userId,
    widgets: [
      { id: 'w1', type: 'stats_critical', w: 3, h: 1, x: 0, y: 0 },
      { id: 'w2', type: 'stats_rejections', w: 3, h: 1, x: 3, y: 0 },
      { id: 'w3', type: 'stats_pending', w: 3, h: 1, x: 6, y: 0 },
      { id: 'w4', type: 'stats_tasks', w: 3, h: 1, x: 9, y: 0 },
      { id: 'w5', type: 'tat_summary', w: 8, h: 2, x: 0, y: 1 },
      { id: 'w6', type: 'quick_links', w: 4, h: 2, x: 8, y: 1 },
      { id: 'w7', type: 'announcements', w: 6, h: 2, x: 0, y: 3 },
      { id: 'w8', type: 'calendar', w: 6, h: 2, x: 6, y: 3 },
    ],
    updatedAt: now,
  };
}

export function createNotificationPreferences(userId: string): NotificationPreference {
  return {
    userId,
    inApp: true,
    email: true,
    criticalValues: true,
    sampleRejections: true,
    maintenanceReminders: true,
    dueDateReminders: true,
  };
}

export function createExtendedSettings(): ExtendedSettings {
  return {
    hospitalName: 'Central Hospital',
    hospitalAddress: 'Riyadh, Saudi Arabia',
    departmentPhone: '+966 11 000 0000',
    departmentEmail: 'hematology@hospital.local',
    primaryColor: '#5B3FD6',
    secondaryColor: '#93C5FD',
    accentColor: '#38BDF8',
    backupEnabled: true,
    backupFrequency: 'daily',
    auditRetentionDays: 365,
    documentRetentionDays: 1825,
    emailTemplates: [
      { id: 'tpl-001', name: 'Critical Value Alert', subject: 'Critical Value Notification — {{patientName}}', body: 'A critical value was reported for patient {{patientName}} ({{test}}: {{value}}).', updatedAt: now },
      { id: 'tpl-002', name: 'Task Due Reminder', subject: 'Task Due: {{taskTitle}}', body: 'Your task "{{taskTitle}}" is due on {{dueDate}}.', updatedAt: now },
    ],
  };
}

export function createModuleData(userId: string) {
  const forms = createDynamicForms(userId);
  return {
    mediaFolders: createMediaFolders(),
    mediaAssets: createMediaAssets(userId),
    dynamicForms: forms,
    formResponses: createFormResponses(forms[0]?.id ?? 'form-001', userId),
    announcements: createAnnouncements(userId),
    calendarEvents: createCalendarEvents(userId),
    libraryDocuments: createLibraryDocuments(userId),
    reportTemplates: createReportTemplates(userId),
    dashboardLayouts: [createDefaultDashboardLayout(userId)],
    notificationPreferences: [createNotificationPreferences(userId)],
    extendedSettings: createExtendedSettings(),
  };
}
