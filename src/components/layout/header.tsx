'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Bell, Globe, LogOut, Menu, Moon, Search, Sun, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/auth-provider';
import { CommandPalette } from '@/components/layout/command-palette';
import { ROLE_LABELS } from '@/lib/permissions/roles';
import { cn } from '@/lib/utils';

interface HeaderProps {
  sidebarCollapsed: boolean;
  onMobileMenuOpen?: () => void;
}

export function Header({ sidebarCollapsed, onMobileMenuOpen }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('common');
  const [paletteOpen, setPaletteOpen] = useState(false);

  const toggleLocale = () => {
    const newLocale = locale === 'en' ? 'ar' : 'en';
    router.push(pathname.replace(`/${locale}`, `/${newLocale}`));
  };

  const handleLogout = async () => {
    await logout();
    router.push(`/${locale}/login`);
  };

  const shortcutLabel = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '⌘K' : 'Ctrl+K';

  return (
    <>
      <header
        className={cn(
          'fixed top-0 end-0 z-30 h-16 border-b border-border/80 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90 transition-all duration-300 start-0',
          sidebarCollapsed ? 'lg:start-[4.5rem]' : 'lg:start-64',
        )}
      >
        <div className="flex h-full items-center gap-3 px-4 md:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMobileMenuOpen}>
            <Menu className="h-5 w-5" />
          </Button>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden min-w-0 flex-1 items-center gap-2 rounded-xl border border-border/80 bg-muted/30 px-3 py-2 text-start text-sm text-muted-foreground transition-colors hover:bg-muted/50 sm:flex md:max-w-md lg:max-w-xl"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">Search anything... (e.g. &quot;QC OUT&quot;, &quot;HQ1147&quot;)</span>
            <kbd className="ms-auto hidden rounded border bg-background px-1.5 py-0.5 text-[10px] md:inline">{shortcutLabel}</kbd>
          </button>

          <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setPaletteOpen(true)}>
            <Search className="h-5 w-5" />
          </Button>

          <div className="ms-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleLocale} title="Switch language">
              <Globe className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/notifications`)}>
              <Bell className="h-5 w-5" />
            </Button>

            <div className="ms-1 hidden items-center gap-2 border-s border-border ps-3 sm:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {(user?.fullName?.[0] ?? 'U').toUpperCase()}
              </div>
              <div className="hidden text-end md:block">
                <p className="text-sm font-medium leading-none">{user?.fullName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {user?.role ? ROLE_LABELS[user.role][locale as 'en' | 'ar'] : ''}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/profile`)} title="Profile">
                <User className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => void handleLogout()} title={t('logout')}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
