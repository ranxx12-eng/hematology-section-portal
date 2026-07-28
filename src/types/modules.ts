export type MediaFileType = 'image' | 'video' | 'pdf' | 'word' | 'excel' | 'powerpoint' | 'zip' | 'other';

export interface MediaFolder {
  id: string;
  name: string;
  parentId?: string;
  createdAt: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  folderId?: string;
  fileType: MediaFileType;
  mimeType: string;
  sizeBytes: number;
  tags: string[];
  category: string;
  dataUrl?: string;
  usageCount: number;
  usageLocations: string[];
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type FormFieldType =
  | 'text' | 'number' | 'date' | 'time' | 'dropdown' | 'radio' | 'checkbox'
  | 'file' | 'signature' | 'email' | 'phone' | 'multiselect';

export interface FormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface DynamicForm {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  isPublished: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormResponse {
  id: string;
  formId: string;
  submittedBy: string;
  answers: Record<string, string | string[] | boolean>;
  submittedAt: string;
}

export type AnnouncementType = 'news' | 'circular' | 'alert' | 'emergency' | 'event';
export type AnnouncementPriority = 'low' | 'normal' | 'high' | 'critical';
export type TargetAudience = 'all' | 'supervisors' | 'technologists' | 'quality' | 'management';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  priority: AnnouncementPriority;
  targetAudience: TargetAudience;
  expiresAt?: string;
  isPinned: boolean;
  isPublished: boolean;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export type CalendarEventType =
  | 'meeting' | 'training' | 'maintenance' | 'cap_visit' | 'cbahi' | 'holiday' | 'staff_schedule';

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location?: string;
  description?: string;
  assignedTo?: string;
  createdBy: string;
  createdAt: string;
}

export type DocumentLibraryCategory =
  | 'sop' | 'policy' | 'cap' | 'cbahi' | 'form' | 'manual' | 'validation' | 'training';

export interface DocumentVersion {
  version: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
  changeNotes?: string;
}

export interface DocumentDownload {
  id: string;
  documentId: string;
  userId: string;
  downloadedAt: string;
}

export interface LibraryDocument {
  id: string;
  documentNumber: string;
  title: string;
  category: DocumentLibraryCategory;
  currentVersion: string;
  versions: DocumentVersion[];
  effectiveDate: string;
  expiryDate?: string;
  ownerId: string;
  status: 'draft' | 'under_review' | 'approved' | 'expired' | 'archived';
  approvalWorkflow: { step: string; approverId?: string; status: 'pending' | 'approved' | 'rejected'; date?: string }[];
  downloadHistory: DocumentDownload[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskProgress {
  taskId: string;
  progress: number;
  lastUpdated: string;
}

export type DashboardWidgetType =
  | 'stats_critical' | 'stats_rejections' | 'stats_pending' | 'stats_tasks'
  | 'tat_summary' | 'quick_links' | 'announcements' | 'calendar' | 'tasks_summary';

export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  w: number;
  h: number;
  x: number;
  y: number;
}

export interface DashboardLayout {
  userId: string;
  widgets: DashboardWidget[];
  updatedAt: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  table: string;
  columns: string[];
  filters: { field: string; operator: string; value: string }[];
  chartType?: 'bar' | 'line' | 'pie' | 'none';
  chartColumn?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreference {
  userId: string;
  inApp: boolean;
  email: boolean;
  criticalValues: boolean;
  sampleRejections: boolean;
  maintenanceReminders: boolean;
  dueDateReminders: boolean;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  updatedAt: string;
}

export interface ExtendedSettings {
  hospitalName: string;
  hospitalAddress: string;
  departmentPhone: string;
  departmentEmail: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backupEnabled: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  auditRetentionDays: number;
  documentRetentionDays: number;
  emailTemplates: EmailTemplate[];
}
