'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  LayoutDashboard, AlertTriangle, XCircle, Hourglass, BarChart3,
  Users2, Target, Newspaper, Settings2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import { PortalLogo } from '@/components/shared/portal-logo';
import type { Permission } from '@/lib/permissions/roles';

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
}

const navItems: NavItem[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/our-leadership', labelKey: 'ourLeadership', icon: Users2 },
  { href: '/mission-vision', labelKey: 'missionVision', icon: Target },
  { href: '/weekly-newsletter', labelKey: 'weeklyNewsletter', icon: Newspaper },
  { href: '/critical-values', labelKey: 'criticalValues', icon: AlertTriangle, permission: 'critical_values.view' },
  { href: '/sample-rejections', labelKey: 'sampleRejections', icon: XCircle, permission: 'sample_rejections.view' },
  { href: '/pending-samples', labelKey: 'pendingSamples', icon: Hourglass, permission: 'tat.view' },
  { href: '/reports', labelKey: 'reports', icon: BarChart3, permission: 'reports.view' },
  { href: '/administration', labelKey: 'administration', icon: Settings2, permission: 'settings.manage' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const t = useTranslations('common');
  const locale = useLocale();
  const pathname = usePathname();
  const { can } = useAuth();

  const visibleItems = navItems.filter((item) => !item.permission || can(item.permission));

  return (
    <aside className={cn(
      'fixed top-0 start-0 z-40 h-screen brand-gradient text-white transition-all duration-300 flex flex-col shadow-lg',
      collapsed ? 'w-16' : 'w-64'
    )}>
      <div className={cn(
        'flex h-16 items-center border-b border-white/15',
        collapsed ? 'flex-col justify-center gap-1 px-1' : 'justify-between px-3'
      )}>
        <PortalLogo
          showText={!collapsed}
          imageClassName={collapsed ? 'h-8 w-8' : 'h-9 w-9'}
          textClassName="text-white"
        />
        <button onClick={onToggle} className="rounded-lg p-1.5 hover:bg-white/10 transition-colors shrink-0">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {visibleItems.map((item) => {
          const href = `/${locale}${item.href}`;
          const isActive = pathname.startsWith(href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200',
                isActive
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-white/75 hover:bg-white/10 hover:text-white'
              )}
              title={collapsed ? t(item.labelKey) : undefined}
            >
              <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-light-blue')} />
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
