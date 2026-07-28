'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Mail, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getMockDatabase } from '@/lib/mock/store';

export default function OurLeadershipPage() {
  const tc = useTranslations('common');
  const leaders = useMemo(() => {
    return [...getMockDatabase().portalContent.leadership].sort((a, b) => a.sortOrder - b.sortOrder);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tc('ourLeadership')}</h1>
        <p className="text-muted-foreground">Meet the leadership team guiding the Hematology Section</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {leaders.map((leader) => (
          <Card key={leader.id} className="overflow-hidden">
            <div className="grid sm:grid-cols-[140px_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={leader.photoUrl} alt={leader.fullName} className="h-full min-h-[180px] w-full object-cover bg-muted" />
              <CardContent className="p-6 space-y-3">
                <div>
                  <h2 className="text-xl font-bold">{leader.fullName}</h2>
                  <p className="text-primary font-medium">{leader.position}</p>
                  <p className="text-sm text-muted-foreground mt-1">{leader.yearsOfExperience} years of experience</p>
                </div>
                <p className="text-sm leading-relaxed">{leader.biography}</p>
                <p className="text-sm"><span className="font-medium">Qualifications:</span> {leader.qualifications}</p>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {leader.email && (
                    <span className="flex items-center gap-1"><Mail className="h-4 w-4" />{leader.email}</span>
                  )}
                  {leader.phoneExtension && (
                    <span className="flex items-center gap-1"><Phone className="h-4 w-4" />Ext. {leader.phoneExtension}</span>
                  )}
                </div>
              </CardContent>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
