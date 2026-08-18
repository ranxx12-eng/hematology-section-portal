'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Upload, Folder, Search, Trash2, Pencil, Replace, Eye, Tag, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/components/providers/auth-provider';
import {
  fetchMediaAssets,
  fetchMediaFolders,
  renameMediaAsset,
  replaceMediaAssetFile,
  softDeleteMediaAsset,
  uploadMediaAsset,
  ROOT_FOLDER_ID,
} from '@/lib/clinical/media-assets';
import type { MediaAsset } from '@/types/modules';

export default function MediaLibraryPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('media.manage');
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [folderId, setFolderId] = useState<string>(ROOT_FOLDER_ID);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [preview, setPreview] = useState<MediaAsset | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [foldersResult, assetsResult] = await Promise.all([
      fetchMediaFolders(),
      fetchMediaAssets(),
    ]);
    setFolders(foldersResult.data.map((f) => ({ id: f.id, name: f.name })));
    setAssets(assetsResult.data);
    setError(foldersResult.error ?? assetsResult.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  const accessDenied = !can('media.view');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  const filteredAssets = useMemo(() => assets.filter((a) => {
    const inFolder = folderId === ROOT_FOLDER_ID ? !a.folderId || a.folderId === ROOT_FOLDER_ID : a.folderId === folderId;
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.tags.some((t) => t.includes(search.toLowerCase()));
    const matchCat = category === 'all' || a.category === category;
    return inFolder && matchSearch && matchCat;
  }), [assets, folderId, search, category]);

  const categories = useMemo(() => [...new Set(assets.map((a) => a.category))], [assets]);

  const handleUpload = async (file: File) => {
    if (!canManage || !user) return;
    setUploading(true);
    const result = await uploadMediaAsset(user.id, file, folderId);
    setUploading(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Upload failed');
      return;
    }
    toast.success('File uploaded');
    void loadMedia();
  };

  const handleRename = async (id: string) => {
    if (!canManage || !renameValue.trim()) return;
    const result = await renameMediaAsset(id, renameValue.trim());
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setRenameId(null);
    toast.success('File renamed');
    void loadMedia();
  };

  const handleDelete = async (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    const result = await softDeleteMediaAsset(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('File deleted');
    void loadMedia();
  };

  const handleReplace = async (file: File) => {
    if (!canManage || !replaceId) return;
    setUploading(true);
    const result = await replaceMediaAssetFile(replaceId, file);
    setUploading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setReplaceId(null);
    toast.success('File replaced');
    void loadMedia();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Media Library</h1>
          <p className="text-muted-foreground">Upload and organize images, videos, documents, and files</p>
        </div>
        {canManage && (
          <>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            <input ref={replaceRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleReplace(e.target.files[0])} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Upload className="h-4 w-4 me-2" />}
              Upload File
            </Button>
          </>
        )}
      </div>

      {error && <EmptyState title="Failed to load media library" description={error} />}

      <div className="grid lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Folder className="h-4 w-4" />Folders</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {folders.map((f) => (
              <button key={f.id} onClick={() => setFolderId(f.id)} className={`w-full text-start rounded-lg px-3 py-2 text-sm transition-colors ${folderId === f.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}>
                {f.name}
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="ps-9" placeholder="Search by name or tag..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredAssets.map((asset) => (
              <Card key={asset.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm truncate">{asset.name}</p>
                      <Badge variant="outline" className="mt-1 capitalize">{asset.fileType}</Badge>
                    </div>
                    <Badge variant="secondary">{(asset.sizeBytes / 1024).toFixed(0)} KB</Badge>
                  </div>
                  {asset.fileType === 'image' && asset.dataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.dataUrl} alt={asset.name} className="rounded-lg h-24 w-full object-cover border border-border" />
                  )}
                  <div className="flex flex-wrap gap-1">
                    {asset.tags.map((t) => <Badge key={t} variant="secondary" className="text-xs"><Tag className="h-3 w-3 me-1" />{t}</Badge>)}
                  </div>
                  <p className="text-xs text-muted-foreground">Used in {asset.usageCount} place(s)</p>
                  <div className="flex gap-1 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => setPreview(asset)}><Eye className="h-3 w-3" /></Button>
                    {canManage && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setRenameId(asset.id); setRenameValue(asset.name); }}><Pencil className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" onClick={() => { setReplaceId(asset.id); replaceRef.current?.click(); }}><Replace className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(asset.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {filteredAssets.length === 0 && <p className="text-center text-muted-foreground py-8">{tc('noData')}</p>}
        </div>
      </div>

      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{preview?.name}</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-3">
              {preview.fileType === 'image' && preview.dataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.dataUrl} alt={preview.name} className="rounded-lg w-full max-h-64 object-contain" />
              )}
              <p className="text-sm"><strong>Type:</strong> {preview.fileType} · <strong>Category:</strong> {preview.category}</p>
              <p className="text-sm"><strong>Usage:</strong> {preview.usageLocations.join(', ') || 'Not used yet'}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameId} onOpenChange={() => setRenameId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename File</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>New Name</Label>
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
            <Button onClick={() => renameId && handleRename(renameId)}>{tc('save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
