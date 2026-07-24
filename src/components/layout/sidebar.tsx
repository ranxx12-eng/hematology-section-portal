'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  LayoutDashboard, Users, CheckSquare, Microscope, Wrench, FlaskConical,
  AlertTriangle, XCircle, FileEdit, Clock, Hourglass, GraduationCap,
  FileText, Package, Calendar, Shield, BarChart3, Bell, ScrollText, Settings,
  ChevronLeft, ChevronRight, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import type { Permission } from '@/lib/permissions/roles';

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
}

const navItems: NavItem[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/employees', labelKey: 'employees', icon: Users, permission: 'employees.view' },
  { href: '/tasks', labelKey: 'tasks', icon: CheckSquare, permission: 'tasks.view' },
  { href: '/instruments', labelKey: 'instruments', icon: Microscope, permission: 'instruments.view' },
  { href: '/maintenance', labelKey: 'maintenance', icon: Wrench, permission: 'maintenance.view' },
  { href: '/quality-control', labelKey: 'qualityControl', icon: FlaskConical, permission: 'qc.view' },
  { href: '/critical-values', labelKey: 'criticalValues', icon: AlertTriangle, permission: 'critical_values.view' },
  { href: '/sample-rejections', labelKey: 'sampleRejections', icon: XCircle, permission: 'sample_rejections.view' },
  { href: '/corrected-results', labelKey: 'correctedResults', icon: FileEdit, permission: 'corrected_results.view' },
  { href: '/tat', labelKey: 'tat', icon: Clock, permission: 'tat.view' },
  { href: '/pending-samples', labelKey: 'pendingSamples', icon: Hourglass, permission: 'tat.view' },
  { href: '/training', labelKey: 'training', icon: GraduationCap, permission: 'training.view' },
  { href: '/documents', labelKey: 'documents', icon: FileText, permission: 'documents.view' },
  { href: '/inventory', labelKey: 'inventory', icon: Package, permission: 'inventory.view' },
  { href: '/meetings', labelKey: 'meetings', icon: Calendar, permission: 'meetings.view' },
  { href: '/risk-capa', labelKey: 'riskCapa', icon: Shield, permission: 'risk.view' },
  { href: '/reports', labelKey: 'reports', icon: BarChart3, permission: 'reports.view' },
  { href: '/notifications', labelKey: 'notifications', icon: Bell, permission: 'notifications.view' },
  { href: '/audit-log', labelKey: 'auditLog', icon: ScrollText, permission: 'audit.view' },
  { href: '/settings', labelKey: 'settings', icon: Settings, permission: 'settings.manage' },
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
      'fixed top-0 start-0 z-40 h-screen bg-dark-navy text-white transition-all duration-300 flex flex-col',
      collapsed ? 'w-16' : 'w-64'
    )}>
      <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
        {!collapsed && (
          <div>
            <h1 className="text-sm font-bold leading-tight">Hematology</h1>
            <p className="text-xs text-white/60">Management Portal</p>
          </div>
        )}
        <button onClick={onToggle} className="rounded-lg p-1.5 hover:bg-white/10 transition-colors">
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
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
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive ? 'bg-medical-blue text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
              title={collapsed ? t(item.labelKey) : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </Link>
          );
        })}
      </nav>
      {!collapsed && (
        <div className="p-4 border-t border-white/10">
          <Link href={`/${locale}/search`} className="flex items-center gap-2 text-sm text-white/60 hover:text-white">
            <Search className="h-4 w-4" />
            {t('search')}
          </Link>
        </div>
      )}
    </aside>
  );
}
