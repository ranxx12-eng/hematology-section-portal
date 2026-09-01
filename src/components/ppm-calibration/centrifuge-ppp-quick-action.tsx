'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getCentrifugePppDisplayStatus } from '@/lib/ppm-calibration/centrifuge-ppp-logic';
import type { CentrifugePppCalibrationListItem } from '@/types/centrifuge-ppp-calibration';

interface CentrifugePppQuickActionProps {
  locale: string;
  records: CentrifugePppCalibrationListItem[];
}

export function CentrifugePppQuickAction({ locale, records }: CentrifugePppQuickActionProps) {
  const latest = records[0];
  const statusLabel = latest
    ? getCentrifugePppDisplayStatus({
      status: latest.status,
      overallResult: latest.overallResult,
      approvalStatus: latest.approvalStatus,
    })
    : 'No calibrations yet';

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium leading-tight">Centrifuge Calibration for PPP</p>
          <p className="text-sm text-muted-foreground">Form-Hema-009</p>
          <p className="text-xs text-muted-foreground">
            Latest status: <span className="font-medium text-foreground">{statusLabel}</span>
          </p>
        </div>
        <Button asChild size="sm" className="w-full shrink-0 sm:w-auto">
          <Link href={`/${locale}/ppm-calibration/centrifuge-ppp`}>Open PPP Calibration</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
