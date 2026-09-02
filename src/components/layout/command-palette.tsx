'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Search } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/components/providers/auth-provider';
import { searchPortal, type SearchResultItem } from '@/lib/clinical/search';
import { filterCommandCenterNav, getCommandPalettePages } from '@/lib/dashboard/command-center-nav';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PaletteItem {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  group: string;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const locale = useLocale();
  const t = useTranslations('common');
  const router = useRouter();
  const { can } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [remoteResults, setRemoteResults] = useState<SearchResultItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const navPages = useMemo(
    () => getCommandPalettePages(can, locale).map((page) => ({
      id: page.id,
      title: t(page.title as Parameters<typeof t>[0]),
      href: page.href,
      group: t(page.group as Parameters<typeof t>[0]),
    })),
    [can, locale, t],
  );

  const staticItems: PaletteItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pages = navPages.filter((page) =>
      !q || page.title.toLowerCase().includes(q) || page.group.toLowerCase().includes(q),
    );
    const remote = remoteResults.map((item) => ({
      id: `${item.type}-${item.id}`,
      title: item.title,
      subtitle: `${item.type} · ${item.subtitle}`,
      href: item.href,
      group: item.type,
    }));
    return [...pages, ...remote];
  }, [navPages, query, remoteResults]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setRemoteResults([]);
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setRemoteResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      const result = await searchPortal(query, locale);
      setRemoteResults(result.data);
      setLoading(false);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [open, query, locale]);

  const openItem = useCallback((href: string) => {
    onOpenChange(false);
    router.push(href);
  }, [onOpenChange, router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
      if (!open) return;
      if (event.key === 'Escape') onOpenChange(false);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, staticItems.length - 1));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (event.key === 'Enter' && staticItems[activeIndex]) {
        event.preventDefault();
        openItem(staticItems[activeIndex].href);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange, staticItems, activeIndex, openItem]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search anything... (e.g. "QC OUT", "HQ1147", "Calibration")'
            className="border-0 shadow-none focus-visible:ring-0"
            autoFocus
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {staticItems.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No results found.</p>
          ) : (
            staticItems.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'flex w-full flex-col items-start rounded-lg px-3 py-2 text-start transition-colors',
                  index === activeIndex ? 'bg-primary/10' : 'hover:bg-muted/60',
                )}
                onClick={() => openItem(item.href)}
              >
                <span className="text-sm font-medium">{item.title}</span>
                <span className="text-xs text-muted-foreground">{item.subtitle ?? item.group}</span>
              </button>
            ))
          )}
        </div>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          ↑↓ navigate · Enter open · Esc close · ⌘K / Ctrl+K
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Register global keyboard shortcut from layout. */
export function useCommandPaletteShortcut(onToggle: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onToggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onToggle]);
}
