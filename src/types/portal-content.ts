export interface LeadershipProfile {
  id: string;
  roleKey: 'lab_director' | 'lab_manager' | 'head_of_section' | 'section_supervisor';
  fullName: string;
  position: string;
  photoUrl: string;
  biography: string;
  qualifications: string;
  yearsOfExperience: number;
  email?: string;
  phoneExtension?: string;
  sortOrder: number;
}

export interface ContentSection {
  id: string;
  sectionKey: 'mission' | 'vision' | 'core_values' | 'quality_commitment' | 'patient_safety' | 'continuous_improvement';
  title: string;
  content: string;
  imageUrl?: string;
  updatedAt: string;
}

export interface Newsletter {
  id: string;
  title: string;
  coverImageUrl: string;
  publicationDate: string;
  author: string;
  description: string;
  topic: string;
  pdfDataUrl?: string;
  onlineContent: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardImages {
  hospitalLogo: string;
  hospitalBuilding: string;
  hematologyLab: string;
  labEquipment: string;
  departmentPhoto: string;
}

export interface PortalContent {
  leadership: LeadershipProfile[];
  missionVision: ContentSection[];
  newsletters: Newsletter[];
  dashboardImages: DashboardImages;
}
