'use client';

import { useTheme } from 'next-themes';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Moon, Sun, Globe, Bell, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/auth-provider';
import { ROLE_LABELS } from '@/lib/permissions/roles';
import { cn } from '@/lib/utils';

interface HeaderProps {
  sidebarCollapsed: boolean;
}

export function Header({ sidebarCollapsed }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('common');

  const toggleLocale = () => {
    const newLocale = locale === 'en' ? 'ar' : 'en';
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  const handleLogout = () => {
    logout();
    router.push(`/${locale}/login`);
  };

  return (
    <header className={cn(
      'fixed top-0 end-0 z-30 h-16 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 transition-all duration-300',
      sidebarCollapsed ? 'start-16' : 'start-64'
    )}>
      <div className="flex h-full items-center justify-between px-6">
        <div />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleLocale} title="Switch language">
            <Globe className="h-5 w-5" />
            <span className="sr-only">{locale === 'en' ? 'AR' : 'EN'}</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/notifications`)}>
            <Bell className="h-5 w-5" />
          </Button>
          <div className="hidden sm:flex items-center gap-2 ms-2 ps-2 border-s border-border">
            <div className="text-end">
              <p className="text-sm font-medium">{user?.fullName}</p>
              <p className="text-xs text-muted-foreground">
                {user?.role ? ROLE_LABELS[user.role][locale as 'en' | 'ar'] : ''}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/profile`)}>
              <User className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} title={t('logout')}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
