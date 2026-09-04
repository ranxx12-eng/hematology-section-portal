'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale } from 'next-intl';
import { InventoryModuleShell } from '@/components/inventory/inventory-module-shell';

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const { can } = useAuth();
  const accessDenied = !can('inventory.view');
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);
  if (accessDenied) return null;

  return <InventoryModuleShell>{children}</InventoryModuleShell>;
}
