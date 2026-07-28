'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getMockDatabase } from '@/lib/mock/store';
import { MISSION_VISION_SECTIONS } from '@/lib/portal-content/defaults';

export default function MissionVisionPage() {
  const tc = useTranslations('common');
  const sections = useMemo(() => {
    const content = getMockDatabase().portalContent.missionVision;
    return MISSION_VISION_SECTIONS.map((s) => content.find((c) => c.sectionKey === s.key)).filter(Boolean);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tc('missionVision')}</h1>
        <p className="text-muted-foreground">Our purpose, values, and commitment to excellence in hematology diagnostics</p>
      </div>

      <div className="space-y-6">
        {sections.map((section, index) => section && (
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
    </div>
  );
}
