export type MedicalReportSectionKey =
  | 'work-sheet'
  | 'mixing-studies'
  | 'blood-film'
  | 'body-fluid'
  | 'manual-tests';

export interface MedicalReportSectionDefinition {
  key: MedicalReportSectionKey;
  href: string;
  navLabelKey: string;
  navIcon: string;
  title: string;
  subtitle: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  newActionLabel: string;
  historyActionLabel: string;
  showSearch: boolean;
}

export const MEDICAL_REPORTS_LANDING = {
  title: 'Medical Reports',
  subtitle: 'Hematology worksheets and diagnostic/manual reporting',
} as const;

export const MEDICAL_REPORT_SECTIONS: MedicalReportSectionDefinition[] = [
  {
    key: 'work-sheet',
    href: '/medical-reports/work-sheet',
    navLabelKey: 'medicalReportsWorkSheet',
    navIcon: 'ClipboardList',
    title: 'Hematology Work Sheet',
    subtitle: 'General hematology worksheet reporting',
    description: 'Daily hematology worksheet records and controlled print output.',
    emptyTitle: 'No work sheets yet',
    emptyDescription: 'The official Hematology Work Sheet form and workflow will be configured here when provided.',
    newActionLabel: 'New Work Sheet',
    historyActionLabel: 'History',
    showSearch: false,
  },
  {
    key: 'mixing-studies',
    href: '/medical-reports/mixing-studies',
    navLabelKey: 'medicalReportsMixingStudies',
    navIcon: 'Blend',
    title: 'PT/PTT Mixing Studies Work Sheet',
    subtitle: 'Dedicated mixing study worksheet',
    description: 'Separate PT/PTT mixing study workflow with its own calculations and interpretation rules.',
    emptyTitle: 'No mixing studies yet',
    emptyDescription: 'Mixing study calculations and the official worksheet will be added when the controlled form is supplied.',
    newActionLabel: 'New Mixing Study',
    historyActionLabel: 'History',
    showSearch: false,
  },
  {
    key: 'blood-film',
    href: '/medical-reports/blood-film',
    navLabelKey: 'medicalReportsBloodFilm',
    navIcon: 'Microscope',
    title: 'Blood Film Reports',
    subtitle: 'Patient blood film morphology reporting',
    description: 'Structured blood film reporting with review, approval, and controlled print templates.',
    emptyTitle: 'No blood film reports yet',
    emptyDescription: 'Blood film morphology fields and the official report layout will be defined in a later phase.',
    newActionLabel: 'New Blood Film Report',
    historyActionLabel: 'History',
    showSearch: true,
  },
  {
    key: 'body-fluid',
    href: '/medical-reports/body-fluid',
    navLabelKey: 'medicalReportsBodyFluid',
    navIcon: 'Droplets',
    title: 'Body Fluid Reports',
    subtitle: 'Form-Hema-010 body fluid & CSF cell count worksheet',
    description: 'Structured body fluid cell count worksheets with dual-tech verification, dilution calculations, and controlled print output.',
    emptyTitle: 'No body fluid worksheets yet',
    emptyDescription: 'Create a new Form-Hema-010 worksheet to record WBC/RBC chamber counts, optional differential, and pathologist review.',
    newActionLabel: 'New Body Fluid Worksheet',
    historyActionLabel: 'History',
    showSearch: true,
  },
  {
    key: 'manual-tests',
    href: '/medical-reports/manual-tests',
    navLabelKey: 'medicalReportsManualTests',
    navIcon: 'TestTubes',
    title: 'Manual Test Reports',
    subtitle: 'Manual hematology test results',
    description: 'Manual test result reporting for hematology bench workflows.',
    emptyTitle: 'No manual test reports yet',
    emptyDescription: 'Manual test types and result fields will be configured when official report definitions are supplied.',
    newActionLabel: 'New Manual Test Report',
    historyActionLabel: 'History',
    showSearch: true,
  },
];

export function getMedicalReportSection(key: MedicalReportSectionKey): MedicalReportSectionDefinition | undefined {
  return MEDICAL_REPORT_SECTIONS.find((section) => section.key === key);
}
