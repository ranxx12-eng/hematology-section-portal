import type { Role } from '@/lib/permissions/roles';

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  employeeId?: string;
  avatarUrl?: string;
  language: 'en' | 'ar';
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  phone?: string;
  jobTitle: string;
  role: Role;
  section: string;
  hireDate: string;
  employmentStatus: 'active' | 'inactive' | 'on_leave';
  shift: 'morning' | 'evening' | 'night';
  supervisorId?: string;
  profilePhoto?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assignedTo: string;
  assignedBy: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'not_started' | 'in_progress' | 'pending_review' | 'completed' | 'overdue' | 'cancelled';
  startDate: string;
  dueDate: string;
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'none';
  taskType: 'daily' | 'weekly' | 'monthly' | 'personal' | 'team';
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  completionEvidence?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Instrument {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  location: string;
  installationDate: string;
  status: 'operational' | 'warning' | 'under_maintenance' | 'out_of_service' | 'decommissioned';
  lastMaintenance?: string;
  nextMaintenance?: string;
  calibrationDueDate?: string;
  warrantyExpiry?: string;
  serviceProvider?: string;
  contactInfo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceRecord {
  id: string;
  instrumentId: string;
  maintenanceType: 'daily' | 'weekly' | 'monthly' | 'preventive' | 'corrective' | 'emergency';
  date: string;
  shift: string;
  performedBy: string;
  checklist: { item: string; completed: boolean }[];
  result: 'pass' | 'fail' | 'partial';
  issueFound?: string;
  correctiveAction?: string;
  ticketNumber?: string;
  engineerName?: string;
  supervisorReview?: boolean;
  reviewDate?: string;
  electronicSignature?: string;
  createdAt: string;
}

export interface QCRecord {
  id: string;
  instrumentId: string;
  parameter: string;
  level: string;
  recordedAt: string;
  qcStatus: 'IN' | 'OUT';
  qcBatchId?: string;
  correctiveActions: string[];
  correctiveActionComment?: string;
  correctiveActionOther?: string;
  resolutionStatus?: 'IN' | 'Still OUT' | 'Pending';
  actionAt?: string;
  actionByUserId?: string;
  actionByName?: string;
  actionByStaffId?: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
  resolvedByName?: string;
  performedByUserId?: string;
  performedByName?: string;
  performedByStaffId?: string;
  comment?: string;
  createdByUserId?: string;
  updatedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CriticalValue {
  id: string;
  date: string;
  patientId: string;
  patientName: string;
  patientAccNumber: string;
  test: string;
  criticalValue: string;
  informedToDr: string;
  drId: string;
  verifyTime: string;
  informedTime: string;
  department: string;
  comment?: string;
  initial: string;
  reportedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type SupervisorReviewStatus = 'pending_supervisor_review' | 'reviewed';

export type ReplacementSampleStatus =
  | 'Awaiting Replacement Sample'
  | 'Replacement Sample Received'
  | 'Completed'
  | 'Discarded'
  | 'Cancelled';

export type DiscardStatus = 'not_due' | 'discard_due' | 'discarded';

export interface SampleRejection {
  id: string;
  patientId: string;
  patientName: string;
  patientLabAccNumber: string;
  department: string;
  rejectionDate: string;
  rejectionTime: string;
  rejectedTests: string[];
  rejectedTube: string;
  rejectionReasons: string[];
  otherRejectionReason?: string;
  informedNurseName: string;
  nurseId: string;
  nurseNotificationDate: string;
  nurseNotificationTime: string;
  doctorNotificationRequired: boolean;
  doctorName?: string;
  doctorId?: string;
  doctorNotificationDate?: string;
  doctorNotificationTime?: string;
  createdByUserId: string;
  createdByStaffName: string;
  createdByStaffId: string;
  recordCreatedDate: string;
  recordCreatedTime: string;
  supervisorReviewStatus: SupervisorReviewStatus;
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewedByStaffId?: string;
  reviewedDate?: string;
  reviewedTime?: string;
  replacementSampleStatus: ReplacementSampleStatus;
  replacementReceivedDate?: string;
  replacementReceivedTime?: string;
  replacementReceivedByUserId?: string;
  replacementReceivedByName?: string;
  replacementReceivedByStaffId?: string;
  completionDate?: string;
  completionTime?: string;
  completedByUserId?: string;
  completedByName?: string;
  completedByStaffId?: string;
  discardDueAt: string;
  discardStatus: DiscardStatus;
  discardDate?: string;
  discardTime?: string;
  discardedByUserId?: string;
  discardedByName?: string;
  discardedByStaffId?: string;
  comments?: string;
  pendingSampleId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CorrectedResult {
  id: string;
  date: string;
  patientId: string;
  test: string;
  originalResult: string;
  correctedResult: string;
  reason: string;
  correctedBy: string;
  physicianNotified: boolean;
  notificationTime?: string;
  approvedBy?: string;
  notes?: string;
  createdAt: string;
}

export interface TATRecord {
  id: string;
  sampleReceivedTime: string;
  resultReleasedTime: string;
  calculatedTat: number;
  targetTat: number;
  testType: string;
  priority: 'stat' | 'routine';
  department: string;
  shift: string;
  instrumentId?: string;
  status: 'within_target' | 'near_breach' | 'breached';
  delayReason?: string;
  createdAt: string;
}

export interface PendingSample {
  id: string;
  sourceType: 'tat' | 'rejection';
  sampleRejectionId?: string;
  patientId: string;
  patientName?: string;
  patientLabAccNumber?: string;
  department?: string;
  rejectedTests?: string[];
  rejectedTube?: string;
  rejectionReasons?: string[];
  rejectionDate?: string;
  rejectionTime?: string;
  test: string;
  priority: 'stat' | 'routine';
  receivedTime: string;
  elapsedMinutes: number;
  instrumentId?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  currentStatus: string;
  replacementSampleStatus?: ReplacementSampleStatus;
  isActive: boolean;
  delayReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  instructor: string;
  startDate: string;
  dueDate: string;
  content?: string;
  passingScore: number;
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
}

export interface Document {
  id: string;
  documentNumber: string;
  title: string;
  category: string;
  version: string;
  effectiveDate: string;
  reviewDate: string;
  ownerId: string;
  status: 'draft' | 'under_review' | 'approved' | 'expired' | 'archived';
  revisionNotes?: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  itemName: string;
  category: string;
  manufacturer?: string;
  catalogNumber?: string;
  lotNumber?: string;
  quantity: number;
  unit: string;
  minimumStock: number;
  maximumStock: number;
  expiryDate?: string;
  storageLocation: string;
  supplier?: string;
  receivedDate?: string;
  openedDate?: string;
  status: 'available' | 'low_stock' | 'expired' | 'depleted';
  barcode?: string;
  createdAt: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  organizerId: string;
  agenda: string;
  discussion?: string;
  decisions?: string;
  minutesApproved: boolean;
  createdAt: string;
}

export interface Risk {
  id: string;
  title: string;
  category: string;
  description: string;
  likelihood: number;
  severity: number;
  riskScore: number;
  existingControls?: string;
  actionPlan?: string;
  ownerId: string;
  dueDate: string;
  residualRisk?: number;
  status: 'open' | 'in_progress' | 'mitigated' | 'closed';
  createdAt: string;
}

export interface CAPARecord {
  id: string;
  source: string;
  problemStatement: string;
  immediateCorrection?: string;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  ownerId: string;
  dueDate: string;
  evidence?: string;
  effectivenessReview?: string;
  closureApproval?: boolean;
  status: 'open' | 'in_progress' | 'pending_review' | 'closed';
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  module: string;
  recordId?: string;
  previousValue?: string;
  newValue?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface EmployeeEvaluation {
  id: string;
  employeeId: string;
  period: string;
  fte: number;
  staffEvaluation: number;
  supervisorEvaluation: number;
  labManagerEvaluation: number;
  labDirectorEvaluation: number;
  finalScore: number;
  rating: string;
  strengths?: string;
  areasForImprovement?: string;
  comments?: string;
  createdBy: string;
  createdAt: string;
}

export interface SystemSettings {
  laboratoryName: string;
  sectionName: string;
  defaultLanguage: 'en' | 'ar';
  timezone: string;
  dateFormat: string;
  tatTargets: { stat: number; routine: number; dDimer: number; er: number; icu: number };
  evaluationWeights: { fte: number; staff: number; supervisor: number; labManager: number; labDirector: number };
  rejectedSampleRetentionDays: number;
}

export interface DashboardStats {
  totalSamples: number;
  routineSamples: number;
  statSamples: number;
  criticalValues: number;
  sampleRejections: number;
  correctedResults: number;
  pendingSamples: number;
  activeInstruments: number;
  instrumentsUnderMaintenance: number;
  expiringInventory: number;
  trainingCompletionRate: number;
  openTasks: number;
}
