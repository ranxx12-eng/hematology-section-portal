'use client';

import { useMemo, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Pin, Download, BookOpen, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchNewsletters } from '@/lib/clinical/cms';
import { EmptyState } from '@/components/shared/empty-state';
import { Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { NEWSLETTER_TOPICS } from '@/lib/portal-content/defaults';
import type { Newsletter } from '@/types/portal-content';

export default function WeeklyNewsletterPage() {
  const tc = useTranslations('common');
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('all');
  const [year, setYear] = useState('all');
  const [topic, setTopic] = useState('all');
  const [reading, setReading] = useState<Newsletter | null>(null);

  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchNewsletters().then((result) => {
      setNewsletters(result.data);
      setError(result.error);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return newsletters
      .filter((n) => {
        const q = search.toLowerCase();
        if (q && !n.title.toLowerCase().includes(q) && !n.description.toLowerCase().includes(q)) return false;
        if (month !== 'all' && new Date(n.publicationDate).getMonth() + 1 !== Number(month)) return false;
        if (year !== 'all' && new Date(n.publicationDate).getFullYear() !== Number(year)) return false;
        if (topic !== 'all' && n.topic !== topic) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.publicationDate.localeCompare(a.publicationDate);
      });
  }, [newsletters, search, month, year, topic]);

  const years = useMemo(() => [...new Set(newsletters.map((n) => new Date(n.publicationDate).getFullYear()))].sort((a, b) => b - a), [newsletters]);

  const downloadPdf = (n: Newsletter) => {
    if (!n.pdfDataUrl) {
      const blob = new Blob([`<html><body><h1>${n.title}</h1>${n.onlineContent}</body></html>`], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${n.title.replace(/\s+/g, '-').toLowerCase()}.html`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const a = document.createElement('a');
    a.href = n.pdfDataUrl;
    a.download = `${n.title.replace(/\s+/g, '-').toLowerCase()}.pdf`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tc('weeklyNewsletter')}</h1>
        <p className="text-muted-foreground">Weekly newsletter archive for the Hematology Section</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Search & Filter</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="ps-9" placeholder="Search newsletters..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{new Date(2000, i, 1).toLocaleString('en', { month: 'long' })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Label>Topic</Label>
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Topics</SelectItem>
                {NEWSLETTER_TOPICS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <EmptyState title="Failed to load newsletters" description={error} />
      ) : filtered.length === 0 ? (
        <EmptyState title={tc('noData')} description="No newsletters match your filters." />
      ) : (
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((n) => (
          <Card key={n.id} className="overflow-hidden flex flex-col">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={n.coverImageUrl} alt={n.title} className="h-40 w-full object-cover" />
              {n.isPinned && (
                <Badge className="absolute top-3 end-3 bg-primary"><Pin className="h-3 w-3 me-1" />Pinned</Badge>
              )}
            </div>
            <CardContent className="p-5 flex-1 flex flex-col">
              <Badge variant="secondary" className="w-fit mb-2">{n.topic}</Badge>
              <h2 className="font-bold text-lg leading-snug">{n.title}</h2>
              <p className="text-xs text-muted-foreground mt-1">{formatDate(n.publicationDate)} • {n.author}</p>
              <p className="text-sm text-muted-foreground mt-3 flex-1">{n.description}</p>
              <div className="flex gap-2 mt-4">
                <Button size="sm" className="flex-1" onClick={() => setReading(n)}>
                  <BookOpen className="h-4 w-4 me-1" />Read Online
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadPdf(n)}>
                  <Download className="h-4 w-4 me-1" />PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      <Dialog open={!!reading} onOpenChange={(o) => !o && setReading(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {reading && (
            <>
              <DialogHeader>
                <DialogTitle>{reading.title}</DialogTitle>
                <p className="text-sm text-muted-foreground">{formatDate(reading.publicationDate)} • {reading.author}</p>
              </DialogHeader>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={reading.coverImageUrl} alt="" className="rounded-lg w-full h-48 object-cover" />
              <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: reading.onlineContent }} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
