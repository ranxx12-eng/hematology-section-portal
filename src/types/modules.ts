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
  | 'text' | 'textarea' | 'number' | 'date' | 'time' | 'datetime'
  | 'dropdown' | 'radio' | 'checkbox' | 'yes_no' | 'multiselect'
  | 'staff_selector' | 'department_selector' | 'instrument_selector' | 'test_selector'
  | 'section_header' | 'instructions' | 'divider'
  | 'file' | 'signature' | 'repeating_table'
  | 'email' | 'phone';

export type FormStatus = 'draft' | 'published' | 'archived';

export interface FormFieldConfig {
  min?: number;
  max?: number;
  decimals?: boolean;
  unit?: string;
  columns?: { key: string; label: string; type: 'text' | 'number' | 'date' | 'time' | 'dropdown'; options?: string[] }[];
  content?: string;
  visible?: boolean;
}

export interface FormField {
  id: string;
  label: string;
  fieldKey?: string;
  type: FormFieldType;
  required: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
  defaultValue?: string;
  config?: FormFieldConfig;
}

export interface DynamicForm {
  id: string;
  title: string;
  formNumber?: string;
  description?: string;
  category?: string;
  version: number;
  status: FormStatus;
  fields: FormField[];
  isPublished: boolean;
  createdBy: string;
  createdByName?: string;
  ownerId?: string;
  ownerName?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  effectiveDate?: string;
  reviewDate?: string;
}

export interface FormSnapshot {
  title: string;
  formNumber?: string;
  version: number;
  fields: FormField[];
}

export interface FormResponse {
  id: string;
  formId: string;
  submittedBy: string;
  submittedByName?: string;
  submittedByStaffId?: string;
  formVersion?: number;
  formSnapshot?: FormSnapshot;
  answers: Record<string, unknown>;
  status: string;
  submittedAt: string;
}

export type FillablePdfFieldType =
  | 'text' | 'number' | 'date' | 'time' | 'datetime'
  | 'dropdown' | 'yes_no' | 'checkbox' | 'multiselect' | 'textarea'
  | 'staff_identity' | 'staff_id' | 'auto_date' | 'auto_time';

export type FillablePdfStatus = 'draft' | 'published' | 'archived';

export interface FillablePdfFieldConfig {
  fontSize?: number;
  multiline?: boolean;
  autoFill?: 'staff_name' | 'staff_id' | 'received_by';
  readOnly?: boolean;
}

export interface FillablePdfField {
  id: string;
  fieldKey: string;
  label: string;
  type: FillablePdfFieldType;
  pageNumber: number;
  posX: number;
  posY: number;
  width: number;
  height: number;
  required: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
  config?: FillablePdfFieldConfig;
}

export interface FillablePdfTemplate {
  id: string;
  title: string;
  formNumber?: string;
  description?: string;
  version: number;
  status: FillablePdfStatus;
  sourcePdfPath: string;
  sourcePdfName?: string;
  pageCount: number;
  pageWidthPt?: number;
  pageHeightPt?: number;
  isPublished: boolean;
  publishedAt?: string;
  createdBy: string;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
  fields: FillablePdfField[];
}

export interface FillablePdfTemplateSnapshot {
  title: string;
  formNumber?: string;
  version: number;
  sourcePdfPath: string;
  pageWidthPt?: number;
  pageHeightPt?: number;
  fields: FillablePdfField[];
}

export interface FillablePdfSubmission {
  id: string;
  templateId: string;
  templateVersion: number;
  submittedBy: string;
  submittedByName?: string;
  submittedByStaffId?: string;
  answers: Record<string, unknown>;
  templateSnapshot: FillablePdfTemplateSnapshot;
  completedPdfPath?: string;
  status: string;
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
  | 'quality_control'
  | 'maintenance'
  | 'active_instruments'
  | 'tasks'
  | 'critical_values'
  | 'sample_rejections'
  | 'need_to_discard_sample'
  | 'pending_samples';

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
