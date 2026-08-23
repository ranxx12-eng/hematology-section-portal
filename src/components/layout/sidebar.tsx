'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import { PortalLogo } from '@/components/shared/portal-logo';
import { createDefaultNavigation } from '@/lib/cms/defaults';
import { getNavIcon } from '@/lib/cms/icons';
import type { Permission } from '@/lib/permissions/roles';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const t = useTranslations('common');
  const locale = useLocale();
  const pathname = usePathname();
  const { can } = useAuth();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const navigation = useMemo(() => createDefaultNavigation(), []);

  const visibleGroups = useMemo(() => navigation
    .filter((g) => g.visible)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => item.visible && (
          item.permissions
            ? item.permissions.some((p) => can(p as Permission))
            : (!item.permission || can(item.permission as Permission))
        ))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .filter((g) => g.items.length > 0), [navigation, can]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside className={cn(
      'fixed top-0 start-0 z-40 h-screen brand-gradient text-white transition-all duration-300 flex flex-col shadow-lg',
      collapsed ? 'w-16' : 'w-64'
    )}>
      <div className={cn(
        'flex h-16 items-center border-b border-white/15',
        collapsed ? 'flex-col justify-center gap-1 px-1' : 'justify-between px-3'
      )}>
        <PortalLogo showText={!collapsed} imageClassName={collapsed ? 'h-8 w-auto max-w-[2rem]' : 'h-9 w-auto max-w-[2.25rem]'} textClassName="text-white" />
        <button onClick={onToggle} className="rounded-lg p-1.5 hover:bg-white/10 transition-colors shrink-0">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-2">
        {visibleGroups.map((group) => {
          const GroupIcon = getNavIcon(group.icon);
          const isOpen = openGroups[group.id] !== false;
          const hasActive = group.items.some((item) => pathname.startsWith(`/${locale}${item.href}`));

          if (collapsed) {
            return group.items.map((item) => {
              const href = `/${locale}${item.href}`;
              const isActive = pathname.startsWith(href);
              const Icon = getNavIcon(item.icon);
              return (
                <Link key={item.id} href={href} className={cn('flex items-center justify-center rounded-lg p-2.5 transition-colors', isActive ? 'bg-white/20' : 'hover:bg-white/10')} title={t(item.labelKey)}>
                  <Icon className="h-5 w-5" />
                </Link>
              );
            });
          }

          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors', hasActive ? 'text-white' : 'text-white/60 hover:text-white/80')}
              >
                <GroupIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-start truncate">{t(group.labelKey)}</span>
                <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="mt-1 ms-1 space-y-0.5 border-s border-white/10 ps-2">
                  {group.items.map((item) => {
                    const href = `/${locale}${item.href}`;
                    const isActive = pathname.startsWith(href);
                    const Icon = getNavIcon(item.icon);
                    return (
                      <Link key={item.id} href={href} className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200', isActive ? 'bg-white/20 text-white shadow-sm' : 'text-white/75 hover:bg-white/10 hover:text-white')}>
                        <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-light-blue')} />
                        <span className="truncate">{t(item.labelKey)}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
