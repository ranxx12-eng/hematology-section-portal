'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Search as SearchIcon, Users, CheckSquare, Microscope, FileText, FlaskConical, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { searchPortal, type SearchResultItem } from '@/lib/clinical/search';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Employee: Users,
  Task: CheckSquare,
  Instrument: Microscope,
  Document: FileText,
  QC: FlaskConical,
};

export default function SearchPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      void searchPortal(query, locale).then((result) => {
        setResults(result.data);
        setError(result.error);
        setLoading(false);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, locale]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{tc('search')}</h1>
        <p className="text-muted-foreground">Search across employees, tasks, instruments, documents, and QC</p>
      </div>

      <div className="relative">
        <SearchIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="ps-10"
          placeholder="Type at least 2 characters to search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {query.length >= 2 && (
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : error ? (
            <EmptyState title="Search failed" description={error} />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{results.length} result(s)</p>
              {results.length === 0 ? (
                <EmptyState title={tc('noData')} description="No matches found." />
              ) : (
                results.map((r) => {
                  const Icon = ICONS[r.type] ?? SearchIcon;
                  return (
                    <Link key={`${r.type}-${r.id}`} href={r.href}>
                      <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                        <CardContent className="flex items-center gap-4 py-3">
                          <div className="rounded-lg bg-primary/10 p-2">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{r.title}</p>
                            <p className="text-sm text-muted-foreground truncate">{r.subtitle}</p>
                          </div>
                          <Badge variant="outline">{r.type}</Badge>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
