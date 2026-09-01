import { MedicalReportSectionPage } from '@/components/medical-reports/medical-report-section-page';
import { getMedicalReportSection } from '@/lib/medical-reports/constants';
import { notFound } from 'next/navigation';

export default function BodyFluidReportsPage() {
  const section = getMedicalReportSection('body-fluid');
  if (!section) notFound();
  return <MedicalReportSectionPage section={section} />;
}
