'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, PanelLeftClose } from 'lucide-react';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import { PortalLogo } from '@/components/shared/portal-logo';
import { filterCommandCenterNav } from '@/lib/dashboard/command-center-nav';
import { getNavIcon } from '@/lib/cms/icons';
import type { Permission } from '@/lib/permissions/roles';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const t = useTranslations('common');
  const locale = useLocale();
  const pathname = usePathname();
  const { can } = useAuth();

  const visibleGroups = useMemo(
    () => filterCommandCenterNav(can),
    [can],
  );

  const navContent = (
    <>
      <div className={cn(
        'flex h-16 items-center border-b border-white/10',
        collapsed ? 'justify-center px-2' : 'justify-between px-4',
      )}>
        {!collapsed && <PortalLogo showText imageClassName="h-9 w-auto max-w-[2.25rem]" textClassName="text-white" />}
        {collapsed && <PortalLogo showText={false} imageClassName="h-8 w-auto max-w-[2rem]" textClassName="text-white" />}
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {visibleGroups.map((group) => (
          <div key={group.id} className="mb-4">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                {t(group.labelKey as Parameters<typeof t>[0])}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const href = `/${locale}${item.href}`;
                const isActive = pathname === href || (item.href !== '/dashboard' && pathname.startsWith(href));
                const Icon = getNavIcon(item.icon);
                const allowed = item.permissions
                  ? item.permissions.some((p) => can(p as Permission))
                  : (!item.permission || can(item.permission as Permission));
                if (!allowed) return null;

                return (
                  <Link
                    key={item.id}
                    href={href}
                    title={collapsed ? t(item.labelKey as Parameters<typeof t>[0]) : undefined}
                    onClick={onMobileClose}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
                      collapsed && 'justify-center px-2',
                      isActive
                        ? 'bg-white/15 text-white shadow-sm ring-1 ring-white/10'
                        : 'text-white/75 hover:bg-white/8 hover:text-white',
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-sky-blue')} />
                    {!collapsed && <span className="truncate">{t(item.labelKey as Parameters<typeof t>[0])}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-2">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white',
            collapsed && 'justify-center',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Close navigation"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 start-0 z-50 flex h-screen flex-col bg-[#2a1f5c] text-white shadow-xl transition-all duration-300',
          collapsed ? 'w-[4.5rem]' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
