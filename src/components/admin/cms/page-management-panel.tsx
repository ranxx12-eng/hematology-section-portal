'use client';

import { toast } from 'sonner';
import { Plus, Trash2, GripVertical, Copy, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { createEmptyPage, createEmptyBlock } from '@/lib/cms/defaults';
import type { CmsPage, CmsAdminState, ContentBlockType } from '@/types/cms-admin';

const BLOCK_TYPES: ContentBlockType[] = ['hero', 'text', 'image', 'stats', 'columns', 'cta', 'html'];

interface Props {
  cms: CmsAdminState;
  onChange: (cms: CmsAdminState) => void;
}

export function PageManagementPanel({ cms, onChange }: Props) {
  const pages = cms.pages;

  const updatePages = (next: CmsPage[]) => onChange({ ...cms, pages: next });

  const updatePage = (id: string, patch: Partial<CmsPage>) => {
    updatePages(pages.map((p) => p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p));
  };

  const addPage = () => updatePages([...pages, createEmptyPage()]);
  const duplicatePage = (page: CmsPage) => updatePages([...pages, { ...page, id: crypto.randomUUID(), title: `${page.title} (Copy)`, slug: `${page.slug}-copy`, status: 'draft', updatedAt: new Date().toISOString() }]);
  const deletePage = (id: string) => updatePages(pages.filter((p) => p.id !== id));

  const moveBlock = (pageId: string, index: number, dir: -1 | 1) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const blocks = [...page.blocks].sort((a, b) => a.sortOrder - b.sortOrder);
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    updatePage(pageId, { blocks: blocks.map((b, i) => ({ ...b, sortOrder: i })) });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Create and manage CMS pages with drag-and-drop content blocks</p>
        <Button onClick={addPage}><Plus className="h-4 w-4 me-2" />Create Page</Button>
      </div>

      {pages.map((page) => (
        <Card key={page.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{page.title}</CardTitle>
              <Badge variant={page.status === 'published' ? 'success' : 'secondary'}>{page.status}</Badge>
              {!page.isVisible && <Badge variant="outline">Hidden</Badge>}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => toast.info('Preview opened (demo)')}><Eye className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => duplicatePage(page)}><Copy className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => deletePage(page.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Title</Label><Input value={page.title} onChange={(e) => updatePage(page.id, { title: e.target.value })} /></div>
              <div className="space-y-2"><Label>Slug</Label><Input value={page.slug} onChange={(e) => updatePage(page.id, { slug: e.target.value })} /></div>
              <div className="space-y-2"><Label>Status</Label>
                <Select value={page.status} onValueChange={(v) => updatePage(page.id, { status: v as CmsPage['status'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2"><Switch checked={page.isVisible} onCheckedChange={(v) => updatePage(page.id, { isVisible: v })} /><Label>Visible</Label></div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Content Blocks</Label>
                <Select onValueChange={(v) => updatePage(page.id, { blocks: [...page.blocks, { ...createEmptyBlock(v as ContentBlockType), sortOrder: page.blocks.length }] })}>
                  <SelectTrigger className="w-40 h-8"><SelectValue placeholder="Add block" /></SelectTrigger>
                  <SelectContent>{BLOCK_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {[...page.blocks].sort((a, b) => a.sortOrder - b.sortOrder).map((block, i) => (
                <div key={block.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline" className="capitalize">{block.type}</Badge>
                    <Input className="h-8 flex-1" value={block.label} onChange={(e) => updatePage(page.id, { blocks: page.blocks.map((b) => b.id === block.id ? { ...b, label: e.target.value } : b) })} />
                    <Button size="sm" variant="ghost" onClick={() => moveBlock(page.id, i, -1)}>↑</Button>
                    <Button size="sm" variant="ghost" onClick={() => moveBlock(page.id, i, 1)}>↓</Button>
                    <Button size="sm" variant="ghost" onClick={() => updatePage(page.id, { blocks: page.blocks.filter((b) => b.id !== block.id) })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                  <Textarea rows={3} value={block.content} onChange={(e) => updatePage(page.id, { blocks: page.blocks.map((b) => b.id === block.id ? { ...b, content: e.target.value } : b) })} placeholder="Block content..." />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
