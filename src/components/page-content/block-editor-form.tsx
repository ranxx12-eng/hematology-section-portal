'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CmsImageUploadField } from '@/components/page-content/cms-image-upload';
import { BLOCK_TYPE_LABELS } from '@/lib/page-content/constants';
import type { PageContentBlockInput } from '@/lib/page-content/schema';

interface BlockEditorFormProps {
  block: PageContentBlockInput & { id?: string; imageSignedUrl?: string | null };
  pageKey: PageContentBlockInput['pageKey'];
  userId: string;
  onChange: (patch: Partial<PageContentBlockInput>) => void;
}

export function BlockEditorForm({ block, pageKey, userId, onChange }: BlockEditorFormProps) {
  const showImage = ['hero', 'image_block', 'banner'].includes(block.blockType);
  const showButton = ['hero', 'image_block', 'quick_link'].includes(block.blockType);
  const showSubtitle = ['page_meta', 'hero'].includes(block.blockType);
  const showBody = !['quick_link', 'banner'].includes(block.blockType);
  const showIcon = block.blockType === 'quick_link';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{BLOCK_TYPE_LABELS[block.blockType]}</Badge>
        <Badge variant={block.status === 'published' ? 'default' : 'secondary'}>{block.status}</Badge>
      </div>

      {block.blockType !== 'notice' && (
        <div>
          <Label>Title / Heading</Label>
          <Input value={block.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} />
        </div>
      )}

      {showSubtitle && (
        <div>
          <Label>Subtitle</Label>
          <Input value={block.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
        </div>
      )}

      {showBody && (
        <div>
          <Label>{block.blockType === 'page_meta' ? 'Intro Text' : 'Body / Content'}</Label>
          <Textarea rows={4} value={block.body ?? ''} onChange={(e) => onChange({ body: e.target.value })} />
        </div>
      )}

      {block.blockType === 'notice' && (
        <div>
          <Label>Notice Text</Label>
          <Textarea rows={3} value={block.body ?? ''} onChange={(e) => onChange({ body: e.target.value })} />
        </div>
      )}

      {showButton && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Button Label</Label>
            <Input value={block.buttonLabel ?? ''} onChange={(e) => onChange({ buttonLabel: e.target.value })} />
          </div>
          <div>
            <Label>Link URL</Label>
            <Input value={block.buttonUrl ?? ''} onChange={(e) => onChange({ buttonUrl: e.target.value })} />
          </div>
        </div>
      )}

      {showIcon && (
        <div>
          <Label>Icon Name (Lucide)</Label>
          <Input value={block.icon ?? ''} onChange={(e) => onChange({ icon: e.target.value })} placeholder="e.g. Calendar" />
        </div>
      )}

      {showImage && (
        <CmsImageUploadField
          label="Image"
          pageKey={pageKey}
          userId={userId}
          previewUrl={block.imageSignedUrl}
          onChange={(storagePath, assetId) => onChange({ imageUrl: storagePath, imageAssetId: assetId })}
        />
      )}

      <div className="flex items-center gap-2">
        <Switch checked={block.isVisible} onCheckedChange={(v) => onChange({ isVisible: v })} />
        <Label>Visible on page</Label>
      </div>
    </div>
  );
}
