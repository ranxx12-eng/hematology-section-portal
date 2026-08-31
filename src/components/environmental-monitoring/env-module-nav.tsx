'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/environmental-monitoring', label: 'Dashboard', exact: true as const },
  { href: '/environmental-monitoring/record', label: 'Record Reading', exact: false as const },
  { href: '/environmental-monitoring/assets', label: 'Assets', exact: false as const },
  { href: '/environmental-monitoring/excursions', label: 'Excursions', exact: false as const },
  { href: '/environmental-monitoring/monthly-logs', label: 'Monthly Logs', exact: false as const },
  { href: '/environmental-monitoring/audit-trail', label: 'Audit Trail', exact: false as const },
  { href: '/environmental-monitoring/setup', label: 'Setup', exact: false as const },
];

export function EnvironmentalModuleNav({ locale }: { locale: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b pb-3">
      {NAV_ITEMS.map((item) => {
        const href = `/${locale}${item.href}`;
        const active = item.exact
          ? pathname === href
          : pathname.startsWith(href);
        return (
          <Link
            key={item.href}
            href={href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
