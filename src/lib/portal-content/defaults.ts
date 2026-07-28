export const DEFAULT_DASHBOARD_IMAGES = {
  hospitalLogo: '/images/portal/hospital-logo.svg',
  hospitalBuilding: '/images/portal/hospital-building.svg',
  hematologyLab: '/images/portal/hematology-lab.svg',
  labEquipment: '/images/portal/lab-equipment.svg',
  departmentPhoto: '/images/portal/department-photo.svg',
} as const;

export const MISSION_VISION_SECTIONS = [
  { key: 'mission', title: 'Mission' },
  { key: 'vision', title: 'Vision' },
  { key: 'core_values', title: 'Core Values' },
  { key: 'quality_commitment', title: 'Quality Commitment' },
  { key: 'patient_safety', title: 'Patient Safety' },
  { key: 'continuous_improvement', title: 'Continuous Improvement' },
] as const;

export const LEADERSHIP_ROLES = [
  { key: 'lab_director', position: 'Lab Director', sortOrder: 1 },
  { key: 'lab_manager', position: 'Lab Manager', sortOrder: 2 },
  { key: 'head_of_section', position: 'Head of Section', sortOrder: 3 },
  { key: 'section_supervisor', position: 'Section Supervisor', sortOrder: 4 },
] as const;

export const NEWSLETTER_TOPICS = [
  'Quality',
  'Safety',
  'Operations',
  'Training',
  'Equipment',
  'Staff Updates',
  'Policy',
  'General',
] as const;
