'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Search as SearchIcon, Users, CheckSquare, Microscope, FileText, FlaskConical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getMockDatabase } from '@/lib/mock/store';

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function SearchPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const db = useMemo(() => getMockDatabase(), []);

  const results = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    const items: SearchResult[] = [];

    db.employees.forEach((e) => {
      if (e.fullName.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.employeeId.toLowerCase().includes(q)) {
        items.push({ type: 'Employee', id: e.id, title: e.fullName, subtitle: e.jobTitle, href: `/${locale}/employees/${e.id}`, icon: Users });
      }
    });
    db.tasks.forEach((t) => {
      if (t.title.toLowerCase().includes(q)) {
        items.push({ type: 'Task', id: t.id, title: t.title, subtitle: t.status, href: `/${locale}/tasks`, icon: CheckSquare });
      }
    });
    db.instruments.forEach((i) => {
      if (i.name.toLowerCase().includes(q) || i.serialNumber.toLowerCase().includes(q)) {
        items.push({ type: 'Instrument', id: i.id, title: i.name, subtitle: i.serialNumber, href: `/${locale}/instruments/${i.id}`, icon: Microscope });
      }
    });
    db.documents.forEach((d) => {
      if (d.title.toLowerCase().includes(q) || d.documentNumber.toLowerCase().includes(q)) {
        items.push({ type: 'Document', id: d.id, title: d.title, subtitle: d.documentNumber, href: `/${locale}/documents`, icon: FileText });
      }
    });
    db.qcRecords.forEach((r) => {
      if (r.test.toLowerCase().includes(q)) {
        items.push({ type: 'QC', id: r.id, title: r.test, subtitle: r.status, href: `/${locale}/quality-control`, icon: FlaskConical });
      }
    });

    return items.slice(0, 20);
  }, [query, db, locale]);

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
          <p className="text-sm text-muted-foreground">{results.length} result(s)</p>
          {results.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{tc('noData')}</p>
          ) : (
            results.map((r) => {
              const Icon = r.icon;
              return (
                <Link key={`${r.type}-${r.id}`} href={r.href}>
                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardContent className="flex items-center gap-4 py-3">
                      <div className="rounded-lg bg-medical-blue/10 p-2">
                        <Icon className="h-4 w-4 text-medical-blue" />
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
        </div>
      )}
    </div>
  );
}
