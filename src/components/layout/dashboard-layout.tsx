'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { cn } from '@/lib/utils';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <Header sidebarCollapsed={collapsed} />
      <main className={cn('pt-16 transition-all duration-300 min-h-screen print:pt-0 print:ps-0', collapsed ? 'ps-16' : 'ps-64')}>
        <div className="p-6 print:p-0">{children}</div>
      </main>
    </div>
  );
}
