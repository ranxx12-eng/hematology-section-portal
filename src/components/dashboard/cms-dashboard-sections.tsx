'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getNavIcon } from '@/lib/cms/icons';
import { fetchPublishedPageBlocks, getPageMetaBlock } from '@/lib/clinical/page-content';
import type { PageContentKey } from '@/lib/page-content/constants';
import type { PageContentBlock } from '@/lib/page-content/schema';

interface CmsDashboardSectionsProps {
  fallbackTitle: string;
  fallbackSubtitle?: string;
  brandingTitle?: string;
}

export function CmsDashboardSections({
  fallbackTitle,
  fallbackSubtitle,
  brandingTitle,
}: CmsDashboardSectionsProps) {
  const [blocks, setBlocks] = useState<PageContentBlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchPublishedPageBlocks('dashboard').then((result) => {
      setBlocks(result.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const meta = getPageMetaBlock(blocks);
  const hero = blocks.find((block) => block.blockType === 'hero');
  const notices = blocks.filter((block) => block.blockType === 'notice');
  const textBlocks = blocks.filter((block) => block.blockType === 'text_block');
  const imageBlocks = blocks.filter((block) => block.blockType === 'image_block');
  const quickLinks = blocks.filter((block) => block.blockType === 'quick_link');

  const heroTitle = hero?.title || meta?.title || fallbackTitle;
  const heroSubtitle = hero?.subtitle || meta?.subtitle || fallbackSubtitle;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border brand-gradient text-white shadow-lg">
        <div className="grid lg:grid-cols-2 gap-6 p-6 md:p-8">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">{heroTitle}</h1>
              {heroSubtitle && <p className="text-lg text-white/90 mt-1">{heroSubtitle}</p>}
              {meta?.body && <p className="text-sm text-white/80 mt-2">{meta.body}</p>}
              {brandingTitle && <p className="text-sm text-white/70 mt-2">{brandingTitle}</p>}
            </div>
            {hero?.buttonLabel && hero.buttonUrl && (
              <Button asChild variant="secondary">
                <Link href={hero.buttonUrl}>{hero.buttonLabel}</Link>
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {hero?.imageSignedUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hero.imageSignedUrl} alt={heroTitle} className="rounded-xl object-cover h-36 w-full border border-white/20 sm:col-span-2" />
            )}
            {imageBlocks.slice(0, 2).map((block) => block.imageSignedUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={block.id} src={block.imageSignedUrl} alt={block.title ?? 'Dashboard image'} className="rounded-xl object-cover h-36 w-full border border-white/20" />
            ))}
          </div>
        </div>
      </section>

      {notices.map((block) => (
        <div key={block.id} className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <Megaphone className="h-5 w-5 shrink-0" />
          <p className="text-sm">{block.body}</p>
        </div>
      ))}

      {textBlocks.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {textBlocks.map((block) => (
            <Card key={block.id}>
              <CardContent className="pt-6">
                {block.title && <h3 className="font-semibold">{block.title}</h3>}
                {block.body && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{block.body}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {quickLinks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickLinks.map((block) => {
            if (!block.buttonUrl) return null;
            const Icon = getNavIcon(block.icon || 'Link');
            return (
              <Button key={block.id} asChild variant="outline" size="sm">
                <Link href={block.buttonUrl}>
                  <Icon className="h-4 w-4 me-2" />
                  {block.title || block.buttonLabel}
                </Link>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
