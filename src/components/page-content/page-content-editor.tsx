'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, Loader2, Plus, Save, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BlockEditorForm } from '@/components/page-content/block-editor-form';
import { PageContentPreview } from '@/components/page-content/page-content-preview';
import {
  BLOCK_TYPE_LABELS,
  PAGE_CONTENT_KEYS,
  PAGE_CONTENT_LABELS,
  pageAllowsBlockType,
  type PageContentKey,
} from '@/lib/page-content/constants';
import {
  createEmptyBlock,
  type PageContentBlock,
  type PageContentBlockInput,
} from '@/lib/page-content/schema';
import {
  fetchPageBlocksForEditor,
  publishPageContentBlocks,
  reorderPageContentBlocks,
  savePageContentBlock,
  softDeletePageContentBlock,
} from '@/lib/clinical/page-content';

interface PageContentEditorProps {
  userId: string;
}

export function PageContentEditor({ userId }: PageContentEditorProps) {
  const [pageKey, setPageKey] = useState<PageContentKey>('dashboard');
  const [blocks, setBlocks] = useState<PageContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const loadBlocks = useCallback(async () => {
    setLoading(true);
    const result = await fetchPageBlocksForEditor(pageKey);
    setBlocks(result.data);
    if (result.error) toast.error(result.error);
    setSelectedId(result.data[0]?.id ?? null);
    setLoading(false);
  }, [pageKey]);

  useEffect(() => {
    void loadBlocks();
  }, [loadBlocks]);

  const selectedBlock = useMemo(
    () => blocks.find((block) => block.id === selectedId) ?? null,
    [blocks, selectedId],
  );

  const addableBlockTypes = useMemo(
    () => PAGE_CONTENT_KEYS.includes(pageKey)
      ? (Object.keys(BLOCK_TYPE_LABELS) as PageContentBlock['blockType'][]).filter((type) =>
          pageAllowsBlockType(pageKey, type) && (type !== 'page_meta' || !blocks.some((b) => b.blockType === 'page_meta')),
        )
      : [],
    [pageKey, blocks],
  );

  const updateSelected = (patch: Partial<PageContentBlockInput>) => {
    if (!selectedBlock) return;
    setBlocks((prev) =>
      prev.map((block) => (block.id === selectedBlock.id ? { ...block, ...patch, status: 'draft' as const } : block)),
    );
  };

  const moveBlock = async (id: string, direction: -1 | 1) => {
    const index = blocks.findIndex((block) => block.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= blocks.length) return;
    const reordered = [...blocks];
    const [item] = reordered.splice(index, 1);
    reordered.splice(target, 0, item);
    setBlocks(reordered.map((block, sortOrder) => ({ ...block, sortOrder })));
    const result = await reorderPageContentBlocks(reordered.map((block) => block.id), userId);
    if (result.error) toast.error(result.error);
  };

  const saveSelected = async () => {
    if (!selectedBlock) return;
    setSaving(true);
    const result = await savePageContentBlock(selectedBlock, userId);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Save failed');
      return;
    }
    setBlocks((prev) => prev.map((block) => (block.id === result.data!.id ? result.data! : block)));
    toast.success('Block saved as draft');
  };

  const saveAllDrafts = async () => {
    setSaving(true);
    for (const block of blocks) {
      const result = await savePageContentBlock(block, userId);
      if (result.error) {
        setSaving(false);
        toast.error(result.error);
        return;
      }
    }
    setSaving(false);
    toast.success('All blocks saved as draft');
    void loadBlocks();
  };

  const publishAll = async () => {
    setPublishing(true);
    for (const block of blocks) {
      const result = await savePageContentBlock({ ...block, status: 'draft' }, userId);
      if (result.error) {
        setPublishing(false);
        toast.error(result.error);
        return;
      }
    }
    const result = await publishPageContentBlocks(pageKey, userId);
    setPublishing(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Page content published');
    void loadBlocks();
  };

  const addBlock = async (blockType: PageContentBlock['blockType']) => {
    const draft = createEmptyBlock(pageKey, blockType, blocks.length);
    setSaving(true);
    const result = await savePageContentBlock(draft, userId);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to add block');
      return;
    }
    setBlocks((prev) => [...prev, result.data!]);
    setSelectedId(result.data!.id);
  };

  const deleteBlock = async (id: string) => {
    if (!confirm('Delete this content block?')) return;
    const result = await softDeletePageContentBlock(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setBlocks((prev) => prev.filter((block) => block.id !== id));
    setSelectedId((current) => (current === id ? null : current));
    toast.success('Block deleted');
  };

  const previewBlocks = previewMode
    ? blocks.filter((block) => block.isVisible)
    : blocks.filter((block) => block.status === 'published' && block.isVisible);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={pageKey} onValueChange={(value) => setPageKey(value as PageContentKey)}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select page" />
            </SelectTrigger>
            <SelectContent>
              {PAGE_CONTENT_KEYS.map((key) => (
                <SelectItem key={key} value={key}>{PAGE_CONTENT_LABELS[key].en}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant={previewMode ? 'default' : 'outline'} size="sm" onClick={() => setPreviewMode((v) => !v)}>
            <Eye className="h-4 w-4 me-2" />
            {previewMode ? 'Editing' : 'Preview'}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void saveAllDrafts()} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
            Save Drafts
          </Button>
          <Button onClick={() => void publishAll()} disabled={publishing || loading}>
            {publishing ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Send className="h-4 w-4 me-2" />}
            Publish Page
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Content Blocks</CardTitle>
              {addableBlockTypes.length > 0 && (
                <Select onValueChange={(value) => void addBlock(value as PageContentBlock['blockType'])}>
                  <SelectTrigger className="w-[180px]">
                    <Plus className="h-4 w-4 me-2" />
                    <SelectValue placeholder="Add block" />
                  </SelectTrigger>
                  <SelectContent>
                    {addableBlockTypes.map((type) => (
                      <SelectItem key={type} value={type}>{BLOCK_TYPE_LABELS[type]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {blocks.length === 0 && <p className="text-sm text-muted-foreground">No blocks yet. Add one to get started.</p>}
              {blocks.map((block, index) => (
                <div
                  key={block.id}
                  className={`flex items-center gap-2 rounded-lg border p-3 ${selectedId === block.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <button type="button" className="flex-1 text-start" onClick={() => setSelectedId(block.id)}>
                    <p className="font-medium text-sm">{BLOCK_TYPE_LABELS[block.blockType]}</p>
                    <p className="text-xs text-muted-foreground truncate">{block.title || block.body || 'Untitled block'}</p>
                  </button>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" disabled={index === 0} onClick={() => void moveBlock(block.id, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" disabled={index === blocks.length - 1} onClick={() => void moveBlock(block.id, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => void deleteBlock(block.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {selectedBlock && !previewMode && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Edit Block</CardTitle>
                  <Button size="sm" onClick={() => void saveSelected()} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Block'}
                  </Button>
                </CardHeader>
                <CardContent>
                  <BlockEditorForm
                    block={selectedBlock}
                    pageKey={pageKey}
                    userId={userId}
                    onChange={updateSelected}
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle>{previewMode ? 'Live Preview' : 'Published Preview'}</CardTitle></CardHeader>
              <CardContent>
                <PageContentPreview pageKey={pageKey} blocks={previewBlocks} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
