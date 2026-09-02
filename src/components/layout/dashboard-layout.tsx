'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { cn } from '@/lib/utils';

const SIDEBAR_COLLAPSED_KEY = 'portal-sidebar-collapsed';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === 'true') setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <Header sidebarCollapsed={collapsed} onMobileMenuOpen={() => setMobileOpen(true)} />
      <main
        className={cn(
          'min-h-screen pt-16 transition-all duration-300 print:pt-0 print:ps-0',
          collapsed ? 'lg:ps-[4.5rem]' : 'lg:ps-64',
        )}
      >
        <div className="p-4 md:p-6 print:p-0">{children}</div>
      </main>
    </div>
  );
}
