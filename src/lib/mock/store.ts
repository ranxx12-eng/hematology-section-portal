import type {
  Employee, Instrument, Task, MaintenanceRecord, QCRecord, CriticalValue,
  SampleRejection, CorrectedResult, TATRecord, PendingSample, TrainingCourse,
  Document, InventoryItem, Meeting, Risk, CAPARecord, Notification, AuditLog,
  EmployeeEvaluation, SystemSettings, DashboardStats, Profile,
} from '@/types';
import type { Role } from '@/lib/permissions/roles';
import { calculateFinalScore, getEvaluationRating } from '@/lib/calculations/evaluation';
import { generateId } from '@/lib/utils';
import { createPortalContent } from '@/lib/mock/portal-content';
import { createModuleData } from '@/lib/mock/modules-data';
import { createDefaultCmsAdmin } from '@/lib/cms/defaults';
import type { PortalContent } from '@/types/portal-content';
import type { CmsAdminState } from '@/types/cms-admin';
import type {
  MediaFolder, MediaAsset, DynamicForm, FormResponse, Announcement, CalendarEvent,
  LibraryDocument, DashboardLayout, ReportTemplate, NotificationPreference, ExtendedSettings,
} from '@/types/modules';

const now = new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

export const DEMO_USERS: { email: string; password: string; role: Role; name: string }[] = [
  { email: 'admin@hematology.local', password: 'Demo@123456', role: 'system_admin', name: 'System Admin' },
  { email: 'director@hematology.local', password: 'Demo@123456', role: 'lab_director', name: 'Lab Director' },
  { email: 'manager@hematology.local', password: 'Demo@123456', role: 'lab_manager', name: 'Lab Manager' },
  { email: 'head@hematology.local', password: 'Demo@123456', role: 'head_of_section', name: 'Head of Section' },
  { email: 'supervisor@hematology.local', password: 'Demo@123456', role: 'section_supervisor', name: 'Section Supervisor' },
  { email: 'quality@hematology.local', password: 'Demo@123456', role: 'quality_link', name: 'Quality Link' },
  { email: 'senior@hematology.local', password: 'Demo@123456', role: 'senior_lab_technologist', name: 'Senior Technologist' },
  { email: 'tech@hematology.local', password: 'Demo@123456', role: 'lab_technologist', name: 'Lab Technologist' },
  { email: 'viewer@hematology.local', password: 'Demo@123456', role: 'viewer', name: 'Viewer' },
];

function createEmployees(): Employee[] {
  const names = [
    { id: 'emp-001', name: 'Abdullah', email: 'abdullah@hematology.local', role: 'head_of_section' as Role, title: 'Head of Section' },
    { id: 'emp-002', name: 'Nahla', email: 'nahla@hematology.local', role: 'section_supervisor' as Role, title: 'Section Supervisor' },
    { id: 'emp-003', name: 'Alhanouf', email: 'alhanouf@hematology.local', role: 'quality_link' as Role, title: 'Quality Link' },
    { id: 'emp-004', name: 'Rawan Alfaifi', email: 'rawan.alfaifi@hematology.local', role: 'senior_lab_technologist' as Role, title: 'Senior Technologist' },
    { id: 'emp-005', name: 'Ahmed', email: 'ahmed@hematology.local', role: 'lab_technologist' as Role, title: 'Lab Technologist' },
    { id: 'emp-006', name: 'Renad', email: 'renad@hematology.local', role: 'lab_technologist' as Role, title: 'Lab Technologist' },
    { id: 'emp-007', name: 'Hamzah', email: 'hamzah@hematology.local', role: 'lab_technologist' as Role, title: 'Lab Technologist' },
    { id: 'emp-008', name: 'Alanoud', email: 'alanoud@hematology.local', role: 'lab_technologist' as Role, title: 'Lab Technologist' },
    { id: 'emp-009', name: 'Fatimah', email: 'fatimah@hematology.local', role: 'lab_technologist' as Role, title: 'Lab Technologist' },
    { id: 'emp-010', name: 'Rawan Albalwi', email: 'rawan.albalwi@hematology.local', role: 'lab_technologist' as Role, title: 'Lab Technologist' },
    { id: 'emp-011', name: 'Rawan Alheta', email: 'rawan.alheta@hematology.local', role: 'lab_technologist' as Role, title: 'Lab Technologist' },
    { id: 'emp-012', name: 'Musa', email: 'musa@hematology.local', role: 'lab_technologist' as Role, title: 'Lab Technologist' },
  ];
  return names.map((n, i) => ({
    id: n.id,
    employeeId: `HEM-${String(i + 1).padStart(4, '0')}`,
    fullName: n.name,
    email: n.email,
    phone: `+96650000${String(i + 1).padStart(4, '0')}`,
    jobTitle: n.title,
    role: n.role,
    section: 'Hematology',
    hireDate: daysAgo(365 * (3 + i % 5)),
    employmentStatus: 'active' as const,
    shift: (['morning', 'evening', 'night'] as const)[i % 3],
    supervisorId: i > 1 ? 'emp-002' : undefined,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }));
}

function createInstruments(): Instrument[] {
  return [
    {
      id: 'inst-001', name: 'Abbott Alinity HQ', manufacturer: 'Abbott', model: 'Alinity HQ',
      serialNumber: 'ALH-2021-001', location: 'Hematology Lab - Bench 1',
      installationDate: daysAgo(900), status: 'operational',
      lastMaintenance: daysAgo(7), nextMaintenance: daysAgo(-7),
      calibrationDueDate: daysAgo(-30), warrantyExpiry: daysAgo(-365),
      serviceProvider: 'Abbott Service', contactInfo: 'service@abbott.com',
      createdAt: now, updatedAt: now,
    },
    {
      id: 'inst-002', name: 'STA-R Max 3', manufacturer: 'Diagnostica Stago', model: 'STA-R Max 3',
      serialNumber: 'STAR-2020-002', location: 'Hematology Lab - Bench 2',
      installationDate: daysAgo(1200), status: 'operational',
      lastMaintenance: daysAgo(3), nextMaintenance: daysAgo(-11),
      calibrationDueDate: daysAgo(-45), warrantyExpiry: daysAgo(-200),
      serviceProvider: 'Stago Service', contactInfo: 'service@stago.com',
      createdAt: now, updatedAt: now,
    },
    {
      id: 'inst-003', name: 'Alifax ESR', manufacturer: 'Alifax', model: 'Test-1',
      serialNumber: 'ALF-2022-003', location: 'Hematology Lab - Bench 3',
      installationDate: daysAgo(600), status: 'warning',
      lastMaintenance: daysAgo(14), nextMaintenance: daysAgo(0),
      calibrationDueDate: daysAgo(-15), warrantyExpiry: daysAgo(-500),
      serviceProvider: 'Alifax Service', contactInfo: 'service@alifax.com',
      createdAt: now, updatedAt: now,
    },
  ];
}

function createTasks(employees: Employee[]): Task[] {
  const statuses: Task['status'][] = ['not_started', 'in_progress', 'pending_review', 'completed', 'overdue'];
  const priorities: Task['priority'][] = ['low', 'medium', 'high', 'critical'];
  return Array.from({ length: 20 }, (_, i) => ({
    id: `task-${String(i + 1).padStart(3, '0')}`,
    title: ['Daily QC Review', 'Weekly Maintenance Check', 'Inventory Count', 'SOP Review', 'Training Completion', 'Calibration Check', 'Sample Processing', 'Report Review', 'Equipment Cleaning', 'Document Update'][i % 10],
    description: `Task description for task ${i + 1}`,
    assignedTo: employees[i % employees.length].id,
    assignedBy: employees[0].id,
    priority: priorities[i % 4],
    status: statuses[i % 5],
    startDate: daysAgo(10 - i),
    dueDate: daysAgo(i > 15 ? 2 : -5),
    recurrence: (['daily', 'weekly', 'monthly', 'none'] as const)[i % 4],
    taskType: (['daily', 'weekly', 'monthly', 'personal', 'team'] as const)[i % 5],
    approvalStatus: i % 3 === 0 ? 'approved' : 'pending',
    createdAt: now, updatedAt: now,
  }));
}

function createQCRecords(instruments: Instrument[]): QCRecord[] {
  return Array.from({ length: 30 }, (_, i) => ({
    id: `qc-${String(i + 1).padStart(3, '0')}`,
    instrumentId: instruments[i % 3].id,
    test: ['CBC', 'PT', 'APTT', 'D-Dimer', 'ESR'][i % 5],
    controlLevel: ['Level 1', 'Level 2', 'Level 3'][i % 3],
    lotNumber: `LOT-2025-${String(i + 1).padStart(3, '0')}`,
    expiryDate: daysAgo(-90 + i),
    recordedAt: daysAgo(i % 30),
    result: 10 + Math.random() * 5,
    mean: 12, standardDeviation: 0.5, cvPercent: 4.2,
    rangeMin: 10, rangeMax: 14,
    status: (['accepted', 'warning', 'rejected', 'pending_review'] as const)[i % 4],
    reviewedBy: i % 2 === 0 ? 'emp-002' : undefined,
    createdAt: now,
  }));
}

function createCriticalValues(): CriticalValue[] {
  return Array.from({ length: 15 }, (_, i) => ({
    id: `cv-${String(i + 1).padStart(3, '0')}`,
    date: daysAgo(i % 30).slice(0, 10),
    patientId: `DEMO-P${String(1000 + i).padStart(6, '0')}`,
    patientName: ['Abdullah Ali', 'Nahla Ahmed', 'Alhanouf Saad', 'Rawan Alfaifi', 'Ahmed Hassan'][i % 5],
    patientAccNumber: `ACC-${String(5000 + i).padStart(6, '0')}`,
    test: ['Platelet Count', 'Hemoglobin', 'WBC', 'INR', 'D-Dimer'][i % 5],
    criticalValue: String(5 + i),
    informedToDr: `Dr. Demo ${i + 1}`,
    drId: `DR-${String(100 + i).padStart(4, '0')}`,
    verifyTime: `${String(8 + (i % 10)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`,
    informedTime: `${String(9 + (i % 9)).padStart(2, '0')}:${String((i * 11) % 60).padStart(2, '0')}`,
    department: ['ER', 'ICU', 'Ward', 'OPD', 'Hematology'][i % 5],
    comment: i % 3 === 0 ? 'Read-back confirmed with nursing staff' : undefined,
    initial: ['Abdullah', 'Nahla', 'Ahmed', 'Renad'][i % 4],
    reportedBy: 'emp-005',
    createdAt: now,
    updatedAt: now,
  }));
}

function createSampleRejections(): SampleRejection[] {
  return Array.from({ length: 12 }, (_, i) => {
    const rejectionDate = daysAgo(i % 10).slice(0, 10);
    const rejectionTime = `${String(8 + (i % 8)).padStart(2, '0')}:30`;
    const discardDueAt = new Date(`${rejectionDate}T${rejectionTime}:00`);
    discardDueAt.setDate(discardDueAt.getDate() + 3);
    const statuses: SampleRejection['replacementSampleStatus'][] = [
      'Awaiting Replacement Sample', 'Replacement Sample Received', 'Completed', 'Discarded', 'Awaiting Replacement Sample',
    ];
    const replacementStatus = statuses[i % 5];
    return {
      id: `sr-${String(i + 1).padStart(3, '0')}`,
      patientId: `DEMO-P${String(2000 + i).padStart(6, '0')}`,
      patientName: ['Abdullah Ali', 'Nahla Ahmed', 'Alhanouf Saad', 'Rawan Alfaifi'][i % 4],
      patientLabAccNumber: `ACC-${String(6000 + i).padStart(6, '0')}`,
      department: ['Emergency Department', 'Intensive Care Unit', 'Medical Ward', 'Outpatient Clinic'][i % 4],
      rejectionDate,
      rejectionTime,
      rejectedTests: [['CBC'], ['PT/INR', 'APTT'], ['D-Dimer']][i % 3],
      rejectedTube: ['EDTA', 'Sodium Citrate', 'ESR Tube'][i % 3],
      rejectionReasons: [['Specimen Hemolyzed'], ['Specimen Clotted'], ['QNS – Quantity Not Sufficient']][i % 3],
      informedNurseName: `Nurse ${i + 1}`,
      nurseId: `NRS-${String(200 + i).padStart(4, '0')}`,
      nurseNotificationDate: rejectionDate,
      nurseNotificationTime: '09:00',
      doctorNotificationRequired: i % 3 === 0,
      doctorName: i % 3 === 0 ? `Dr. Sample ${i + 1}` : undefined,
      doctorId: i % 3 === 0 ? `DR-${String(300 + i).padStart(4, '0')}` : undefined,
      doctorNotificationDate: i % 3 === 0 ? rejectionDate : undefined,
      doctorNotificationTime: i % 3 === 0 ? '09:15' : undefined,
      createdByUserId: 'emp-005',
      createdByStaffName: 'Ahmed',
      createdByStaffId: 'HEM-0005',
      recordCreatedDate: rejectionDate,
      recordCreatedTime: rejectionTime,
      supervisorReviewStatus: i % 4 === 0 ? 'pending_supervisor_review' : 'reviewed',
      reviewedByName: i % 4 === 0 ? undefined : 'Nahla',
      reviewedByStaffId: i % 4 === 0 ? undefined : 'HEM-0002',
      reviewedDate: i % 4 === 0 ? undefined : rejectionDate,
      reviewedTime: i % 4 === 0 ? undefined : '10:00',
      replacementSampleStatus: replacementStatus,
      replacementReceivedDate: ['Replacement Sample Received', 'Completed'].includes(replacementStatus) ? rejectionDate : undefined,
      replacementReceivedTime: ['Replacement Sample Received', 'Completed'].includes(replacementStatus) ? '14:00' : undefined,
      replacementReceivedByName: ['Replacement Sample Received', 'Completed'].includes(replacementStatus) ? 'Renad' : undefined,
      completionDate: replacementStatus === 'Completed' ? rejectionDate : undefined,
      completionTime: replacementStatus === 'Completed' ? '16:00' : undefined,
      completedByName: replacementStatus === 'Completed' ? 'Renad' : undefined,
      discardDueAt: discardDueAt.toISOString(),
      discardStatus: replacementStatus === 'Discarded' ? 'discarded' : i === 11 ? 'discard_due' : 'not_due',
      comments: i % 2 === 0 ? 'Recollection requested from ward nurse' : undefined,
      createdAt: now,
      updatedAt: now,
    };
  });
}

function createTATRecords(instruments: Instrument[]): TATRecord[] {
  return Array.from({ length: 50 }, (_, i) => {
    const priority = i % 3 === 0 ? 'stat' : 'routine';
    const target = priority === 'stat' ? 60 : 240;
    const tat = 30 + Math.floor(Math.random() * (priority === 'stat' ? 80 : 300));
    const received = new Date(Date.now() - tat * 60000 - i * 3600000);
    const released = new Date(received.getTime() + tat * 60000);
    return {
      id: `tat-${String(i + 1).padStart(3, '0')}`,
      sampleReceivedTime: received.toISOString(),
      resultReleasedTime: released.toISOString(),
      calculatedTat: tat,
      targetTat: target,
      testType: ['CBC', 'PT', 'APTT', 'D-Dimer', 'ESR'][i % 5],
      priority: priority as 'stat' | 'routine',
      department: ['ER', 'ICU', 'Ward', 'OPD'][i % 4],
      shift: ['morning', 'evening', 'night'][i % 3],
      instrumentId: instruments[i % 3].id,
      status: (tat > target ? 'breached' : tat > target * 0.85 ? 'near_breach' : 'within_target') as TATRecord['status'],
      createdAt: now,
    };
  });
}

function createPendingSamples(instruments: Instrument[], employees: Employee[], rejections: SampleRejection[]): PendingSample[] {
  const tatSamples = Array.from({ length: 5 }, (_, i) => ({
    id: `ps-tat-${String(i + 1).padStart(3, '0')}`,
    sourceType: 'tat' as const,
    patientId: `DEMO-P${String(3000 + i).padStart(6, '0')}`,
    test: ['CBC', 'PT', 'D-Dimer', 'ESR'][i % 4],
    priority: (i % 3 === 0 ? 'stat' : 'routine') as 'stat' | 'routine',
    receivedTime: daysAgo(0),
    elapsedMinutes: 20 + i * 15,
    instrumentId: instruments[i % 3].id,
    assignedStaffId: employees[4 + (i % 4)].id,
    assignedStaffName: employees[4 + (i % 4)].fullName,
    currentStatus: ['Processing', 'Pending Review', 'On Instrument'][i % 3],
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }));

  const rejectionPending = rejections
    .filter((r) => r.replacementSampleStatus !== 'Completed' && r.replacementSampleStatus !== 'Discarded')
    .map((r, i) => ({
      id: `ps-rej-${String(i + 1).padStart(3, '0')}`,
      sourceType: 'rejection' as const,
      sampleRejectionId: r.id,
      patientId: r.patientId,
      patientName: r.patientName,
      patientLabAccNumber: r.patientLabAccNumber,
      department: r.department,
      rejectedTests: r.rejectedTests,
      rejectedTube: r.rejectedTube,
      rejectionReasons: r.rejectionReasons,
      rejectionDate: r.rejectionDate,
      rejectionTime: r.rejectionTime,
      test: r.rejectedTests.join(', '),
      priority: 'routine' as const,
      receivedTime: `${r.rejectionDate}T${r.rejectionTime}:00`,
      elapsedMinutes: Math.max(0, Math.round((Date.now() - new Date(`${r.rejectionDate}T${r.rejectionTime}:00`).getTime()) / 60000)),
      assignedStaffId: employees[4 + (i % 4)].id,
      assignedStaffName: employees[4 + (i % 4)].fullName,
      currentStatus: r.discardStatus === 'discard_due' ? 'Discard Due' : r.replacementSampleStatus,
      replacementSampleStatus: r.replacementSampleStatus,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }));

  return [...rejectionPending, ...tatSamples];
}

function createInventory(): InventoryItem[] {
  return Array.from({ length: 15 }, (_, i) => ({
    id: `inv-${String(i + 1).padStart(3, '0')}`,
    itemName: ['CBC Reagent', 'PT Reagent', 'QC Control L1', 'QC Control L2', 'Calibrator', 'Pipette Tips', 'Gloves', 'ESR Tubes'][i % 8],
    category: (['reagents', 'controls', 'calibrators', 'consumables', 'ppe'] as const)[i % 5],
    manufacturer: 'Demo Manufacturer',
    catalogNumber: `CAT-${i + 1}`,
    lotNumber: `LOT-${2025}-${i + 1}`,
    quantity: i % 4 === 0 ? 2 : 20 + i,
    unit: ['box', 'vial', 'pack'][i % 3],
    minimumStock: 5,
    maximumStock: 50,
    expiryDate: daysAgo(i % 3 === 0 ? 15 : -60),
    storageLocation: `Shelf ${String.fromCharCode(65 + (i % 4))}-${i % 5 + 1}`,
    supplier: 'Demo Supplier',
    status: (i % 4 === 0 ? 'low_stock' : i % 5 === 0 ? 'expired' : 'available') as InventoryItem['status'],
    barcode: `BC${String(i + 1).padStart(8, '0')}`,
    createdAt: now,
  }));
}

function createEvaluations(employees: Employee[]): EmployeeEvaluation[] {
  return employees.slice(0, 8).map((emp, i) => {
    const input = { fte: 0.8 + i * 0.02, staffEvaluation: 3 + (i % 3), supervisorEvaluation: 4, labManagerEvaluation: 4, labDirectorEvaluation: 4 };
    const finalScore = calculateFinalScore(input);
    return {
      id: `eval-${String(i + 1).padStart(3, '0')}`,
      employeeId: emp.id,
      period: '2025-H1',
      ...input,
      finalScore,
      rating: getEvaluationRating(finalScore),
      strengths: 'Reliable, punctual, good team player',
      areasForImprovement: 'Continue developing advanced skills',
      createdBy: 'emp-001',
      createdAt: now,
    };
  });
}

export interface MockDatabase {
  employees: Employee[];
  instruments: Instrument[];
  tasks: Task[];
  maintenanceRecords: MaintenanceRecord[];
  qcRecords: QCRecord[];
  criticalValues: CriticalValue[];
  sampleRejections: SampleRejection[];
  correctedResults: CorrectedResult[];
  tatRecords: TATRecord[];
  pendingSamples: PendingSample[];
  trainingCourses: TrainingCourse[];
  documents: Document[];
  inventoryItems: InventoryItem[];
  meetings: Meeting[];
  risks: Risk[];
  capaRecords: CAPARecord[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  evaluations: EmployeeEvaluation[];
  settings: SystemSettings;
  portalContent: PortalContent;
  mediaFolders: MediaFolder[];
  mediaAssets: MediaAsset[];
  dynamicForms: DynamicForm[];
  formResponses: FormResponse[];
  announcements: Announcement[];
  calendarEvents: CalendarEvent[];
  libraryDocuments: LibraryDocument[];
  reportTemplates: ReportTemplate[];
  dashboardLayouts: DashboardLayout[];
  notificationPreferences: NotificationPreference[];
  extendedSettings: ExtendedSettings;
  cmsAdmin: CmsAdminState;
}

export function createMockDatabase(): MockDatabase {
  const employees = createEmployees();
  const instruments = createInstruments();
  const tasks = createTasks(employees);
  const qcRecords = createQCRecords(instruments);
  const criticalValues = createCriticalValues();
  const sampleRejections = createSampleRejections();
  const tatRecords = createTATRecords(instruments);
  const pendingSamples = createPendingSamples(instruments, employees, sampleRejections);
  const inventoryItems = createInventory();
  const evaluations = createEvaluations(employees);

  return {
    employees,
    instruments,
    tasks,
    maintenanceRecords: Array.from({ length: 15 }, (_, i) => ({
      id: `maint-${String(i + 1).padStart(3, '0')}`,
      instrumentId: instruments[i % 3].id,
      maintenanceType: (['daily', 'weekly', 'monthly', 'preventive', 'corrective'] as const)[i % 5],
      date: daysAgo(i % 30),
      shift: ['morning', 'evening', 'night'][i % 3],
      performedBy: employees[4 + (i % 4)].id,
      checklist: [
        { item: 'Visual inspection', completed: true },
        { item: 'Clean probes', completed: true },
        { item: 'Check reagent levels', completed: i % 3 !== 0 },
      ],
      result: (i % 5 === 0 ? 'fail' : 'pass') as 'pass' | 'fail' | 'partial',
      supervisorReview: i % 2 === 0,
      createdAt: now,
    })),
    qcRecords,
    criticalValues,
    sampleRejections,
    correctedResults: Array.from({ length: 10 }, (_, i) => ({
      id: `cr-${String(i + 1).padStart(3, '0')}`,
      date: daysAgo(i % 30),
      patientId: `DEMO-P${String(4000 + i).padStart(6, '0')}`,
      test: ['CBC', 'PT', 'INR'][i % 3],
      originalResult: String(10 + i),
      correctedResult: String(12 + i),
      reason: 'Transcription error',
      correctedBy: 'emp-005',
      physicianNotified: i % 2 === 0,
      approvedBy: 'emp-002',
      createdAt: now,
    })),
    tatRecords,
    pendingSamples,
    trainingCourses: Array.from({ length: 8 }, (_, i) => ({
      id: `tc-${String(i + 1).padStart(3, '0')}`,
      title: ['Hematology SOP', 'Safety Training', 'QC Procedures', 'Instrument Operation', 'Blood Bank Basics'][i % 5],
      description: 'Training course description',
      category: ['SOP', 'Safety', 'Quality', 'Technical'][i % 4],
      instructor: employees[0].fullName,
      startDate: daysAgo(30),
      dueDate: daysAgo(-30),
      passingScore: 80,
      status: 'active' as const,
      createdAt: now,
    })),
    documents: Array.from({ length: 12 }, (_, i) => ({
      id: `doc-${String(i + 1).padStart(3, '0')}`,
      documentNumber: `SOP-HEM-${String(i + 1).padStart(3, '0')}`,
      title: ['CBC Procedure', 'Coagulation SOP', 'Sample Collection', 'QC Policy', 'Safety Manual'][i % 5],
      category: (['SOP', 'Policy', 'Form', 'Checklist', 'Manual'] as const)[i % 5],
      version: '1.0',
      effectiveDate: daysAgo(180),
      reviewDate: daysAgo(-180),
      ownerId: employees[0].id,
      status: (['approved', 'under_review', 'draft'] as const)[i % 3],
      createdAt: now,
    })),
    inventoryItems,
    meetings: Array.from({ length: 5 }, (_, i) => ({
      id: `meet-${String(i + 1).padStart(3, '0')}`,
      title: ['Weekly Section Meeting', 'Quality Review', 'Safety Briefing', 'Training Review', 'Monthly KPI'][i],
      date: daysAgo(i * 7),
      time: '10:00',
      location: 'Conference Room A',
      organizerId: employees[0].id,
      agenda: 'Meeting agenda items',
      minutesApproved: i % 2 === 0,
      createdAt: now,
    })),
    risks: Array.from({ length: 8 }, (_, i) => ({
      id: `risk-${String(i + 1).padStart(3, '0')}`,
      title: ['Sample mix-up', 'Reagent expiry', 'Equipment failure', 'Staff shortage'][i % 4],
      category: ['Operational', 'Quality', 'Safety', 'Compliance'][i % 4],
      description: 'Risk description',
      likelihood: 1 + (i % 5),
      severity: 1 + ((i + 2) % 5),
      riskScore: (1 + (i % 5)) * (1 + ((i + 2) % 5)),
      ownerId: employees[2].id,
      dueDate: daysAgo(-30),
      status: (['open', 'in_progress', 'mitigated', 'closed'] as const)[i % 4],
      createdAt: now,
    })),
    capaRecords: Array.from({ length: 6 }, (_, i) => ({
      id: `capa-${String(i + 1).padStart(3, '0')}`,
      source: ['QC Failure', 'Sample Rejection', 'Audit Finding'][i % 3],
      problemStatement: 'Problem description',
      correctiveAction: 'Corrective action plan',
      ownerId: employees[2].id,
      dueDate: daysAgo(-14),
      status: (['open', 'in_progress', 'pending_review', 'closed'] as const)[i % 4],
      createdAt: now,
    })),
    notifications: Array.from({ length: 10 }, (_, i) => ({
      id: `notif-${String(i + 1).padStart(3, '0')}`,
      userId: employees[i % employees.length].id,
      type: ['task_due', 'maintenance_due', 'training_due', 'inventory_low'][i % 4],
      title: ['Task Due', 'Maintenance Due', 'Training Due', 'Low Stock'][i % 4],
      message: 'Notification message',
      isRead: i % 3 === 0,
      createdAt: daysAgo(i),
    })),
    auditLogs: Array.from({ length: 20 }, (_, i) => ({
      id: `audit-${String(i + 1).padStart(3, '0')}`,
      userId: employees[i % 3].id,
      action: ['create', 'update', 'delete', 'approve', 'login'][i % 5],
      module: ['employees', 'tasks', 'qc', 'maintenance', 'auth'][i % 5],
      recordId: `rec-${i}`,
      createdAt: daysAgo(i),
    })),
    evaluations,
    settings: {
      laboratoryName: 'Central Laboratory',
      sectionName: 'Hematology Section',
      defaultLanguage: 'en',
      timezone: 'Asia/Riyadh',
      dateFormat: 'dd/MM/yyyy',
      tatTargets: { stat: 60, routine: 240, dDimer: 60, er: 90, icu: 90 },
      evaluationWeights: { fte: 0.4, staff: 0.3, supervisor: 0.1, labManager: 0.1, labDirector: 0.1 },
      rejectedSampleRetentionDays: 3,
    },
    portalContent: createPortalContent(),
    ...createModuleData(employees[0].id),
    cmsAdmin: createDefaultCmsAdmin(),
  };
}

export function getDashboardStats(db: MockDatabase): DashboardStats {
  return {
    totalSamples: db.tatRecords.length + db.pendingSamples.length,
    routineSamples: db.tatRecords.filter((t) => t.priority === 'routine').length,
    statSamples: db.tatRecords.filter((t) => t.priority === 'stat').length,
    criticalValues: db.criticalValues.length,
    sampleRejections: db.sampleRejections.length,
    correctedResults: db.correctedResults.length,
    pendingSamples: db.pendingSamples.filter((p) => p.isActive).length,
    activeInstruments: db.instruments.filter((i) => i.status === 'operational').length,
    instrumentsUnderMaintenance: db.instruments.filter((i) => i.status === 'under_maintenance' || i.status === 'warning').length,
    expiringInventory: db.inventoryItems.filter((i) => i.status === 'expired' || i.status === 'low_stock').length,
    trainingCompletionRate: 78,
    openTasks: db.tasks.filter((t) => !['completed', 'cancelled'].includes(t.status)).length,
  };
}

const STORAGE_KEY = 'hematology-portal-db';
const AUTH_KEY = 'hematology-portal-auth';

let memoryDb: MockDatabase | null = null;

function normalizeDatabase(db: MockDatabase): MockDatabase {
  if (!db.portalContent) db.portalContent = createPortalContent();
  if (!db.settings.rejectedSampleRetentionDays) db.settings.rejectedSampleRetentionDays = 3;
  db.pendingSamples = db.pendingSamples.map((p) => ({
    ...p,
    isActive: p.isActive ?? true,
    sourceType: p.sourceType ?? 'tat',
    updatedAt: p.updatedAt ?? p.createdAt,
  }));
  const moduleDefaults = createModuleData(db.employees[0]?.id ?? 'emp-001');
  if (!db.mediaFolders) db.mediaFolders = moduleDefaults.mediaFolders;
  if (!db.mediaAssets) db.mediaAssets = moduleDefaults.mediaAssets;
  if (!db.dynamicForms) db.dynamicForms = moduleDefaults.dynamicForms;
  if (!db.formResponses) db.formResponses = moduleDefaults.formResponses;
  if (!db.announcements) db.announcements = moduleDefaults.announcements;
  if (!db.calendarEvents) db.calendarEvents = moduleDefaults.calendarEvents;
  if (!db.libraryDocuments) db.libraryDocuments = moduleDefaults.libraryDocuments;
  if (!db.reportTemplates) db.reportTemplates = moduleDefaults.reportTemplates;
  if (!db.dashboardLayouts) db.dashboardLayouts = moduleDefaults.dashboardLayouts;
  if (!db.notificationPreferences) db.notificationPreferences = moduleDefaults.notificationPreferences;
  if (!db.extendedSettings) db.extendedSettings = moduleDefaults.extendedSettings;
  if (!db.cmsAdmin) db.cmsAdmin = createDefaultCmsAdmin();
  return db;
}

export function getMockDatabase(): MockDatabase {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { return normalizeDatabase(JSON.parse(stored)); } catch { /* fall through */ }
    }
    const db = createMockDatabase();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return db;
  }
  if (!memoryDb) memoryDb = createMockDatabase();
  return memoryDb;
}

export function saveMockDatabase(db: MockDatabase): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } else {
    memoryDb = db;
  }
}

export function getDemoProfile(email: string): Profile | null {
  const demo = DEMO_USERS.find((u) => u.email === email);
  if (!demo) return null;
  return {
    id: generateId(),
    email: demo.email,
    fullName: demo.name,
    role: demo.role,
    language: 'en',
    createdAt: now,
    updatedAt: now,
  };
}

export function getStoredAuth(): Profile | null {
  if (typeof window === 'undefined') return null;
  const stored = sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY);
  if (!stored) return null;
  try { return JSON.parse(stored); } catch { return null; }
}

export function setStoredAuth(profile: Profile, remember = false): void {
  if (typeof window === 'undefined') return;
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(AUTH_KEY, JSON.stringify(profile));
}

export function clearStoredAuth(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(AUTH_KEY);
}

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project');
}
