'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { fetchContentSections } from '@/lib/clinical/cms';
import { MISSION_VISION_SECTIONS } from '@/lib/portal-content/defaults';
import type { ContentSection } from '@/types/portal-content';

export default function MissionVisionPage() {
  const tc = useTranslations('common');
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchContentSections().then((result) => {
      setSections(result.data);
      setError(result.error);
      setLoading(false);
    });
  }, []);

  const orderedSections = useMemo(
    () => MISSION_VISION_SECTIONS.map((s) => sections.find((c) => c.sectionKey === s.key)).filter(Boolean),
    [sections],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tc('missionVision')}</h1>
        <p className="text-muted-foreground">Our purpose, values, and commitment to excellence in hematology diagnostics</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <EmptyState title="Failed to load content" description={error} />
      ) : orderedSections.length === 0 ? (
        <EmptyState title={tc('noData')} description="Mission and vision content has not been configured yet." />
      ) : (
        <div className="space-y-6">
          {orderedSections.map((section, index) => section && (
            <Card key={section.id}>
              <div className={`grid gap-6 ${section.imageUrl ? 'lg:grid-cols-2' : ''}`}>
                <CardHeader className={index % 2 === 1 && section.imageUrl ? 'lg:order-2' : ''}>
                  <CardTitle className="text-xl text-primary">{section.title}</CardTitle>
                </CardHeader>
                {section.imageUrl && (
                  <div className={`px-6 pb-0 ${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={section.imageUrl} alt={section.title} className="rounded-xl w-full h-48 object-cover border border-border" />
                  </div>
                )}
                <CardContent className={`prose prose-sm dark:prose-invert max-w-none ${index % 2 === 1 && section.imageUrl ? 'lg:order-2' : ''}`}>
                  <div dangerouslySetInnerHTML={{ __html: section.content.includes('<') ? section.content : `<p>${section.content}</p>` }} />
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
