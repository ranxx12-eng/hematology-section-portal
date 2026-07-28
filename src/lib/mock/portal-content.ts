import type { PortalContent, LeadershipProfile, ContentSection, Newsletter } from '@/types/portal-content';
import { DEFAULT_DASHBOARD_IMAGES, LEADERSHIP_ROLES, MISSION_VISION_SECTIONS } from '@/lib/portal-content/defaults';
import { generateId } from '@/lib/utils';

const now = new Date().toISOString();

function createLeadership(): LeadershipProfile[] {
  const profiles = [
    { roleKey: 'lab_director' as const, fullName: 'Dr. Khalid Al-Rashid', email: 'director@hematology.local', ext: '4201', years: 22, bio: 'Board-certified hematopathologist leading laboratory medicine strategy, accreditation readiness, and clinical-laboratory integration across the organization.', quals: 'MD, FRCPath, MSc Clinical Pathology' },
    { roleKey: 'lab_manager' as const, fullName: 'Nahla Al-Qahtani', email: 'manager@hematology.local', ext: '4202', years: 16, bio: 'Operational leader overseeing staffing, budgeting, workflow optimization, and inter-department coordination for hematology services.', quals: 'MSc Medical Laboratory Science, ASCP CM' },
    { roleKey: 'head_of_section' as const, fullName: 'Abdullah Al-Harbi', email: 'head@hematology.local', ext: '4203', years: 14, bio: 'Head of Hematology Section responsible for analytical quality, method validation, and section performance metrics.', quals: 'BSc Medical Technology, Specialist Hematology' },
    { roleKey: 'section_supervisor' as const, fullName: 'Nahla Al-Mutairi', email: 'supervisor@hematology.local', ext: '4204', years: 10, bio: 'Frontline supervisor coordinating daily bench operations, competency assessments, and shift handover communication.', quals: 'BSc Clinical Laboratory Science' },
  ];
  return profiles.map((p, i) => ({
    id: `lead-${i + 1}`,
    roleKey: p.roleKey,
    fullName: p.fullName,
    position: LEADERSHIP_ROLES.find((r) => r.key === p.roleKey)?.position ?? p.roleKey,
    photoUrl: `/images/portal/department-photo.svg`,
    biography: p.bio,
    qualifications: p.quals,
    yearsOfExperience: p.years,
    email: p.email,
    phoneExtension: p.ext,
    sortOrder: i + 1,
  }));
}

function createMissionVision(): ContentSection[] {
  const content: Record<string, string> = {
    mission: 'To deliver accurate, timely, and patient-centered hematology diagnostics through excellence in pre-analytical, analytical, and post-analytical processes while supporting safe clinical decision-making.',
    vision: 'To be a nationally recognized center of excellence in hematology laboratory services, innovation, and continuous quality improvement.',
    core_values: 'Integrity • Accuracy • Teamwork • Accountability • Patient Safety • Professionalism • Continuous Learning',
    quality_commitment: 'We maintain rigorous quality systems aligned with international standards, including robust IQC, EQA participation, document control, and management review.',
    patient_safety: 'Patient safety is embedded in every process—from specimen collection guidance to critical value notification, corrected results management, and sample rejection workflows.',
    continuous_improvement: 'We pursue data-driven improvement through KPI monitoring, root cause analysis, staff development, and adoption of best practices in hematology diagnostics.',
  };
  return MISSION_VISION_SECTIONS.map((s, i) => ({
    id: `mv-${i + 1}`,
    sectionKey: s.key,
    title: s.title,
    content: content[s.key],
    imageUrl: i % 2 === 0 ? '/images/portal/hematology-lab.svg' : '/images/portal/lab-equipment.svg',
    updatedAt: now,
  }));
}

function createNewsletters(): Newsletter[] {
  return [
    {
      id: 'nl-001', title: 'Hematology Quality Highlights – Week 24', coverImageUrl: '/images/portal/newsletter-cover.svg',
      publicationDate: '2026-07-21', author: 'Alhanouf (Quality Link)', topic: 'Quality',
      description: 'Weekly update on QC performance, sample rejection trends, and corrective actions.',
      onlineContent: '<p>This week the section maintained 98% QC acceptance rate. Key focus areas include clot detection reduction and STAT TAT monitoring.</p>',
      isPinned: true, createdAt: now, updatedAt: now,
    },
    {
      id: 'nl-002', title: 'Safety Brief: Specimen Handling Update', coverImageUrl: '/images/portal/newsletter-cover.svg',
      publicationDate: '2026-07-14', author: 'Nahla Al-Mutairi', topic: 'Safety',
      description: 'Updated guidance for EDTA and citrate tube handling during summer transport conditions.',
      onlineContent: '<p>Please review the revised specimen transport checklist and ensure cold-chain compliance for coagulation samples.</p>',
      isPinned: false, createdAt: now, updatedAt: now,
    },
    {
      id: 'nl-003', title: 'New Analyzer Training Schedule', coverImageUrl: '/images/portal/newsletter-cover.svg',
      publicationDate: '2026-07-07', author: 'Abdullah Al-Harbi', topic: 'Training',
      description: 'Training sessions for Abbott Alinity HQ advanced maintenance procedures.',
      onlineContent: '<p>Mandatory refresher sessions are scheduled for all senior technologists next week.</p>',
      isPinned: false, createdAt: now, updatedAt: now,
    },
  ];
}

export function createPortalContent(): PortalContent {
  return {
    leadership: createLeadership(),
    missionVision: createMissionVision(),
    newsletters: createNewsletters(),
    dashboardImages: { ...DEFAULT_DASHBOARD_IMAGES },
  };
}

export function createEmptyNewsletter(): Newsletter {
  return {
    id: generateId(),
    title: '',
    coverImageUrl: '/images/portal/newsletter-cover.svg',
    publicationDate: new Date().toISOString().slice(0, 10),
    author: '',
    description: '',
    topic: 'General',
    onlineContent: '',
    isPinned: false,
    createdAt: now,
    updatedAt: now,
  };
}
