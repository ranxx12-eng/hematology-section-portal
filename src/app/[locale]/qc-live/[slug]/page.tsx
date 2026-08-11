import { notFound } from 'next/navigation';
import { isValidQCLiveSlug } from '@/lib/qc-records/live-slugs';
import { LiveQCView } from '@/components/qc-live/live-qc-view';

interface QCLivePageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function QCLivePage({ params }: QCLivePageProps) {
  const { slug } = await params;

  if (!isValidQCLiveSlug(slug)) {
    notFound();
  }

  return <LiveQCView slug={slug} />;
}
