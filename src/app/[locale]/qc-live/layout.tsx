import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'QC Live View | Hematology Section Portal',
  description: 'Read-only live quality control status for laboratory instruments',
};

export default function QCLiveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
