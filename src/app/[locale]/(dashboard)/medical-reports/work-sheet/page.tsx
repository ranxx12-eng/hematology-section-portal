import { MedicalReportSectionPage } from '@/components/medical-reports/medical-report-section-page';
import { getMedicalReportSection } from '@/lib/medical-reports/constants';
import { notFound } from 'next/navigation';

export default function WorkSheetPage() {
  const section = getMedicalReportSection('work-sheet');
  if (!section) notFound();
  return <MedicalReportSectionPage section={section} />;
}
