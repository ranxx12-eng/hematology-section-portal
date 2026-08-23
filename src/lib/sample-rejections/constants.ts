export const REJECTION_DEPARTMENTS = [
  'Emergency Department',
  'Intensive Care Unit',
  'Medical Ward',
  'Surgical Ward',
  'Outpatient Clinic',
  'Hematology Section',
  'Oncology Clinic',
  'Pediatrics',
  'Labor & Delivery',
  'Operating Room',
] as const;

export const REJECTED_TESTS = [
  'CBC',
  'PT/INR',
  'APTT',
  'D-Dimer',
  'Fibrinogen',
  'ESR',
  'Blood Smear',
  'Reticulocyte Count',
  'Hemoglobin Electrophoresis',
  'Flow Cytometry',
  'Bone Marrow Aspirate',
] as const;

export const REJECTED_TUBES = [
  'EDTA',
  'Sodium Citrate',
  'Plain Tube',
  'SST',
  'Heparin',
  'ESR Tube',
  'Slide',
  'Other',
] as const;

export const REJECTION_REASONS = [
  'Specimen Hemolyzed',
  'Specimen Clotted',
  'QNS – Quantity Not Sufficient',
  'Inconsistent with Previous Results',
  'Specimen Unlabelled',
  'Specimen Mislabelled',
  'Specimen Not Kept at the Correct Temperature',
  'Specimen Inadequately Labelled',
  'Wrong Collection Container',
  'Specimen Lost',
  'Container Spilled or Leaking',
  'Collection Tube Overfilled',
  'Collection Tube Underfilled',
  'Specimen Not Received',
  'Specimen Received Late',
  'Request Form Incomplete or Inaccurate',
  'Test Not Recommended',
  'Broken Slides',
  'Referred-In Case Without Laboratory Reports',
  'Other – Platelet Clumps',
  'Other',
] as const;

export const REPLACEMENT_SAMPLE_STATUSES = [
  'Awaiting Replacement Sample',
  'Replacement Sample Received',
  'Completed',
  'Discarded',
  'Cancelled',
] as const;

export const SUPERVISOR_REVIEW_ROLES = [
  'section_supervisor',
  'head_of_section',
  'quality_officer',
  'quality_link',
  'lab_manager',
  'system_admin',
] as const;

export const SUPERVISOR_REVIEW_STATUS_LABELS: Record<string, string> = {
  pending_supervisor_review: 'Pending Review',
  reviewed: 'Reviewed',
};

export const DISCARD_AUTHORIZED_ROLES = [
  'section_supervisor',
  'head_of_section',
  'lab_manager',
  'quality_link',
  'system_admin',
] as const;
