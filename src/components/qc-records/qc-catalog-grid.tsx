'use client';

import Link from 'next/link';
import { ClipboardCheck, FlaskConical, History, TestTubes } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { monthName } from '@/lib/shared/month-names';
import { formatDateTime } from '@/lib/utils';
import type { QcCatalogCardViewModel } from '@/lib/qc-records/qc-catalog';

function statusVariant(status: QcCatalogCardViewModel['status']): 'default' | 'secondary' | 'destructive' | 'warning' | 'outline' {
  switch (status) {
    case 'OUT':
    case 'Pending Change Stain':
      return 'destructive';
    case 'Pending Review':
    case 'Reviewed / Pending Approval':
      return 'warning';
    case 'Coming Soon':
      return 'outline';
    case 'Not Recorded':
    case 'Due':
      return 'secondary';
    default:
      return 'default';
  }
}

interface QcCatalogGridProps {
  cards: QcCatalogCardViewModel[];
  locale: string;
  canManage: boolean;
  canReview: boolean;
  onRecord: (card: QcCatalogCardViewModel) => void;
  onViewHistory?: (card: QcCatalogCardViewModel) => void;
}

export function QcCatalogGrid({
  cards,
  locale,
  canManage,
  canReview,
  onRecord,
  onViewHistory,
}: QcCatalogGridProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">QC Catalog</h2>
        <p className="text-sm text-muted-foreground">
          Choose a QC workflow to record results, review history, or open the monthly form.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.kind === 'rapi_stain' ? TestTubes : FlaskConical;
          const canRecord = canManage && !card.disabled;
          const monthlyFormHref = card.sheetId
            ? `/${locale}/quality-control/stain-qc/hema-021/${card.sheetId}`
            : `/${locale}/quality-control/stain-qc/hema-021`;
          return (
            <Card key={card.id} className={card.disabled ? 'opacity-70' : undefined}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      {card.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{card.subtitle}</p>
                  </div>
                  <Badge variant={statusVariant(card.status)}>{card.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <dl className="grid grid-cols-1 gap-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Instrument</dt>
                    <dd className="text-end">{card.instrumentName}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Frequency</dt>
                    <dd className="text-end">{card.frequency}</dd>
                  </div>
                  {card.kind === 'rapi_stain' && card.sheetMonth && card.sheetYear && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Current sheet</dt>
                      <dd className="text-end">{monthName(card.sheetMonth)} {card.sheetYear}</dd>
                    </div>
                  )}
                  {card.lastRecordedAt && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Last recorded</dt>
                      <dd className="text-end">{formatDateTime(card.lastRecordedAt, locale)}</dd>
                    </div>
                  )}
                  {card.lotNumber && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Active lot</dt>
                      <dd className="text-end">{card.lotNumber}{card.expiryDate ? ` · exp ${card.expiryDate}` : ''}</dd>
                    </div>
                  )}
                </dl>
                <div className="flex flex-wrap gap-2">
                  {canRecord && (
                    <Button size="sm" onClick={() => onRecord(card)} disabled={card.disabled}>
                      Record QC
                    </Button>
                  )}
                  {card.kind === 'rapi_stain' && (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={monthlyFormHref}>
                        <History className="h-4 w-4 me-1" />
                        View Monthly Form
                      </Link>
                    </Button>
                  )}
                  {canReview && card.status === 'Pending Review' && card.kind !== 'rapi_stain' && (
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/${locale}/quality-control/review`}>
                        <ClipboardCheck className="h-4 w-4 me-1" />
                        Review
                      </Link>
                    </Button>
                  )}
                  {canReview && card.status === 'Pending Review' && card.kind === 'rapi_stain' && card.sheetId && (
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/${locale}/quality-control/stain-qc/hema-021/${card.sheetId}`}>
                        <ClipboardCheck className="h-4 w-4 me-1" />
                        Review
                      </Link>
                    </Button>
                  )}
                  {card.kind !== 'rapi_stain' && card.kind !== 'coming_soon' && onViewHistory && (
                    <Button size="sm" variant="outline" onClick={() => onViewHistory(card)}>
                      <History className="h-4 w-4 me-1" />
                      View History
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
