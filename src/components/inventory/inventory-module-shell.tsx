'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { INVENTORY_MODULE_SUBTITLE, INVENTORY_TABS } from '@/lib/inventory/constants';
import { fetchInventoryModuleSummary } from '@/lib/clinical/inventory';
import { InventorySummaryCards } from '@/components/inventory/inventory-summary-cards';
import type { InventoryModuleSummary } from '@/types/inventory-module';

export function InventoryModuleShell({ children }: { children: React.ReactNode }) {
  const tc = useTranslations('common');
  const locale = useLocale();
  const pathname = usePathname();
  const [summary, setSummary] = useState<InventoryModuleSummary | null>(null);

  useEffect(() => {
    void fetchInventoryModuleSummary().then((res) => {
      if (res.data) setSummary(res.data);
    });
  }, [pathname]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tc('inventory')}</h1>
        <p className="text-muted-foreground mt-1">{INVENTORY_MODULE_SUBTITLE}</p>
      </div>

      {summary && <InventorySummaryCards summary={summary} />}

      <div className="overflow-x-auto -mx-1 px-1">
        <nav className="inline-flex min-w-full gap-1 rounded-xl border bg-muted/30 p-1">
          {INVENTORY_TABS.map((tab) => {
            const href = `/${locale}${tab.href}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={tab.id}
                href={href}
                className={cn(
                  'whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-background text-primary shadow-sm ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
