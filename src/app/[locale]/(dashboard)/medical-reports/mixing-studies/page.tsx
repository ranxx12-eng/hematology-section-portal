import { MedicalReportSectionPage } from '@/components/medical-reports/medical-report-section-page';
import { getMedicalReportSection } from '@/lib/medical-reports/constants';
import { notFound } from 'next/navigation';

export default function MixingStudiesPage() {
  const section = getMedicalReportSection('mixing-studies');
  if (!section) notFound();
  return <MedicalReportSectionPage section={section} />;
}
