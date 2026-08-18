'use client';

import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { fetchPublishedPageBlocks, getPageMetaBlock } from '@/lib/clinical/page-content';
import type { PageContentKey } from '@/lib/page-content/constants';
import type { PageContentBlock } from '@/lib/page-content/schema';

interface PageContentSectionsProps {
  pageKey: PageContentKey;
  fallbackTitle: string;
  fallbackSubtitle?: string;
  children?: React.ReactNode;
}

export function PageContentSections({
  pageKey,
  fallbackTitle,
  fallbackSubtitle,
  children,
}: PageContentSectionsProps) {
  const [blocks, setBlocks] = useState<PageContentBlock[]>([]);

  useEffect(() => {
    void fetchPublishedPageBlocks(pageKey).then((result) => setBlocks(result.data));
  }, [pageKey]);

  const meta = getPageMetaBlock(blocks);
  const banner = blocks.find((block) => block.blockType === 'banner');
  const infoBlocks = blocks.filter((block) => block.blockType === 'info_text');
  const notices = blocks.filter((block) => block.blockType === 'notice');

  const title = meta?.title || fallbackTitle;
  const subtitle = meta?.body || fallbackSubtitle;

  return (
    <div className="space-y-6">
      {banner?.imageSignedUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={banner.imageSignedUrl} alt={banner.title ?? title} className="h-36 w-full rounded-xl object-cover border" />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>

      {notices.map((block) => (
        <div key={block.id} className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <Megaphone className="h-5 w-5 shrink-0" />
          <p className="text-sm">{block.body}</p>
        </div>
      ))}

      {infoBlocks.map((block) => (
        <Card key={block.id}>
          <CardContent className="pt-6">
            {block.title && <h3 className="font-medium">{block.title}</h3>}
            {block.body && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{block.body}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
