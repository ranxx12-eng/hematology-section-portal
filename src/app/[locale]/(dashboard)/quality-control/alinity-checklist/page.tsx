'use client';

import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/components/providers/auth-provider';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { AlinityQcChecklist } from '@/components/qc-records/alinity-qc-checklist';

export default function AlinityChecklistPage() {
  const params = useSearchParams();
  const locale = useLocale();
  const { can } = useAuth();
  const accessDenied = !can('qc.view');
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;
  const year = Number(params.get('year'));
  const month = Number(params.get('month'));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Form-Hema-024 QC Checklist</h1>
        <p className="text-muted-foreground">Monthly Alinity HQ checklist for the instrument selected below.</p>
      </div>
      <AlinityQcChecklist
        initialInstrumentId={params.get('instrumentId') ?? undefined}
        initialYear={Number.isInteger(year) && year > 0 ? year : undefined}
        initialMonth={Number.isInteger(month) && month > 0 ? month : undefined}
      />
    </div>
  );
}
