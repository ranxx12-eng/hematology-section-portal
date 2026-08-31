'use client';

import { useLocale } from 'next-intl';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useAuth } from '@/components/providers/auth-provider';
import { EnvironmentalModuleNav } from '@/components/environmental-monitoring/env-module-nav';
import { canViewEnvironmental } from '@/lib/environmental-monitoring/permissions';

export default function EnvironmentalMonitoringLayout({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const { can } = useAuth();
  const accessDenied = !canViewEnvironmental(can);

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  return (
    <div className="space-y-6">
      <EnvironmentalModuleNav locale={locale} />
      {children}
    </div>
  );
}
