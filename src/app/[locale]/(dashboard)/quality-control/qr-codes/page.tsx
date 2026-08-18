'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowLeft, Loader2, QrCode } from 'lucide-react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useAuth } from '@/components/providers/auth-provider';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { QRCodeCard } from '@/components/qc-live/qr-code-card';
import { QC_LIVE_SLUG_BY_NAME } from '@/lib/qc-records/live-slugs';
import { fetchQCInstruments } from '@/lib/clinical/qc-records';

interface InstrumentWithSlug {
  id: string;
  name: string;
  slug: string;
}

export default function QCQRCodesPage() {
  const locale = useLocale();
  const { can } = useAuth();
  const canAccess = can('qc.manage');

  const [instruments, setInstruments] = useState<InstrumentWithSlug[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const accessDenied = !canAccess;
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  const loadInstruments = useCallback(async () => {
    setLoading(true);
    setError(null);
    const rows = await fetchQCInstruments();
    const withSlugs = rows
      .map((row) => ({
        ...row,
        slug: QC_LIVE_SLUG_BY_NAME[row.name] ?? '',
      }))
      .filter((row) => row.slug);
    setInstruments(withSlugs);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadInstruments();
  }, [loadInstruments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/${locale}/quality-control`}>
                <ArrowLeft className="h-4 w-4 me-1" />
                Quality Control
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <QrCode className="h-6 w-6" />
            QC Live QR Codes
          </h1>
          <p className="text-muted-foreground">
            Generate and print QR codes for read-only live QC views at each instrument.
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin me-2" />
          Loading instruments…
        </div>
      )}

      {!loading && error && (
        <EmptyState title="Unable to load instruments" description={error} />
      )}

      {!loading && !error && instruments.length === 0 && (
        <EmptyState
          title="No instruments configured"
          description="QC instruments with live view slugs will appear here."
        />
      )}

      {!loading && instruments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {instruments.map((instrument) => (
            <QRCodeCard
              key={instrument.id}
              instrumentName={instrument.name}
              slug={instrument.slug}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}
