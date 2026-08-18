'use client';

import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getNavIcon } from '@/lib/cms/icons';
import { getPageMetaBlock } from '@/lib/clinical/page-content';
import type { PageContentKey } from '@/lib/page-content/constants';
import type { PageContentBlock } from '@/lib/page-content/schema';

interface PageContentPreviewProps {
  pageKey: PageContentKey;
  blocks: PageContentBlock[];
}

export function PageContentPreview({ pageKey, blocks }: PageContentPreviewProps) {
  if (blocks.length === 0) {
    return <p className="text-sm text-muted-foreground">No visible content to preview.</p>;
  }

  if (pageKey === 'dashboard') {
    return <DashboardPreview blocks={blocks} />;
  }

  return <ClinicalPagePreview blocks={blocks} />;
}

function DashboardPreview({ blocks }: { blocks: PageContentBlock[] }) {
  const hero = blocks.find((block) => block.blockType === 'hero');
  const notices = blocks.filter((block) => block.blockType === 'notice');
  const textBlocks = blocks.filter((block) => block.blockType === 'text_block');
  const imageBlocks = blocks.filter((block) => block.blockType === 'image_block');
  const quickLinks = blocks.filter((block) => block.blockType === 'quick_link');

  return (
    <div className="space-y-4">
      {hero && (
        <section className="rounded-2xl border brand-gradient p-6 text-white">
          <h2 className="text-xl font-bold">{hero.title}</h2>
          {hero.subtitle && <p className="text-white/90 mt-1">{hero.subtitle}</p>}
          {hero.imageSignedUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero.imageSignedUrl} alt={hero.title ?? 'Hero'} className="mt-4 h-32 w-full rounded-xl object-cover" />
          )}
          {hero.buttonLabel && hero.buttonUrl && (
            <Button asChild className="mt-4" variant="secondary">
              <Link href={hero.buttonUrl}>{hero.buttonLabel}</Link>
            </Button>
          )}
        </section>
      )}

      {notices.map((block) => (
        <div key={block.id} className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <Megaphone className="h-5 w-5 shrink-0" />
          <p className="text-sm">{block.body}</p>
        </div>
      ))}

      {textBlocks.map((block) => (
        <Card key={block.id}>
          <CardContent className="pt-6">
            {block.title && <h3 className="font-semibold">{block.title}</h3>}
            {block.body && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{block.body}</p>}
          </CardContent>
        </Card>
      ))}

      <div className="grid gap-4 md:grid-cols-2">
        {imageBlocks.map((block) => (
          <Card key={block.id}>
            <CardContent className="pt-6 space-y-2">
              {block.imageSignedUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={block.imageSignedUrl} alt={block.title ?? 'Image'} className="h-28 w-full rounded-lg object-cover" />
              )}
              {block.title && <p className="font-medium">{block.title}</p>}
              {block.body && <p className="text-sm text-muted-foreground">{block.body}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {quickLinks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickLinks.map((block) => {
            const Icon = getNavIcon(block.icon || 'Link');
            return block.buttonUrl ? (
              <Button key={block.id} asChild variant="outline" size="sm">
                <Link href={block.buttonUrl}>
                  <Icon className="h-4 w-4 me-2" />
                  {block.title || block.buttonLabel}
                </Link>
              </Button>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

function ClinicalPagePreview({ blocks }: { blocks: PageContentBlock[] }) {
  const meta = getPageMetaBlock(blocks);
  const banner = blocks.find((block) => block.blockType === 'banner');
  const infoBlocks = blocks.filter((block) => block.blockType === 'info_text');
  const notices = blocks.filter((block) => block.blockType === 'notice');

  return (
    <div className="space-y-4">
      {meta && (
        <div>
          <h2 className="text-xl font-bold">{meta.title}</h2>
          {meta.body && <p className="text-muted-foreground mt-1">{meta.body}</p>}
        </div>
      )}
      {banner?.imageSignedUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={banner.imageSignedUrl} alt={banner.title ?? 'Banner'} className="h-32 w-full rounded-xl object-cover border" />
      )}
      {notices.map((block) => (
        <Badge key={block.id} variant="outline" className="whitespace-normal h-auto py-2 px-3">
          {block.body}
        </Badge>
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
