'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Upload, Folder, Search, Trash2, Pencil, Replace, Eye, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog } from '@/lib/page-utils';
import { generateId } from '@/lib/utils';
import type { MediaAsset, MediaFileType } from '@/types/modules';

const FILE_TYPES: MediaFileType[] = ['image', 'video', 'pdf', 'word', 'excel', 'powerpoint', 'zip'];

function detectFileType(mime: string): MediaFileType {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('word') || mime.includes('document')) return 'word';
  if (mime.includes('sheet') || mime.includes('excel')) return 'excel';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'powerpoint';
  if (mime.includes('zip')) return 'zip';
  return 'other';
}

export default function MediaLibraryPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('media.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [folderId, setFolderId] = useState<string>('folder-root');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [preview, setPreview] = useState<MediaAsset | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  if (!can('media.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const assets = useMemo(() => db.mediaAssets.filter((a) => {
    const inFolder = folderId === 'folder-root' ? true : a.folderId === folderId;
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.tags.some((t) => t.includes(search.toLowerCase()));
    const matchCat = category === 'all' || a.category === category;
    return inFolder && matchSearch && matchCat;
  }), [db.mediaAssets, folderId, search, category]);

  const categories = useMemo(() => [...new Set(db.mediaAssets.map((a) => a.category))], [db.mediaAssets]);

  const handleUpload = (file: File) => {
    if (!canManage || !user) return;
    const reader = new FileReader();
    reader.onload = () => {
      const asset: MediaAsset = {
        id: generateId(),
        name: file.name,
        folderId: folderId === 'folder-root' ? undefined : folderId,
        fileType: detectFileType(file.type),
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        tags: [],
        category: 'General',
        dataUrl: typeof reader.result === 'string' ? reader.result : undefined,
        usageCount: 0,
        usageLocations: [],
        uploadedBy: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.mediaAssets.push(asset);
      appendAuditLog(db, user.id, 'create', 'media', asset.id);
      saveMockDatabase(db);
      refresh();
      toast.success('File uploaded');
    };
    reader.readAsDataURL(file);
  };

  const handleRename = (id: string) => {
    if (!canManage || !renameValue.trim() || !user) return;
    const asset = db.mediaAssets.find((a) => a.id === id);
    if (asset) {
      asset.name = renameValue.trim();
      asset.updatedAt = new Date().toISOString();
      appendAuditLog(db, user.id, 'update', 'media', id);
      saveMockDatabase(db);
      refresh();
      setRenameId(null);
      toast.success('File renamed');
    }
  };

  const handleDelete = (id: string) => {
    if (!canManage || !user || !confirm(tc('confirmDelete'))) return;
    db.mediaAssets = db.mediaAssets.filter((a) => a.id !== id);
    appendAuditLog(db, user.id, 'delete', 'media', id);
    saveMockDatabase(db);
    refresh();
    toast.success('File deleted');
  };

  const handleReplace = (file: File) => {
    if (!canManage || !replaceId || !user) return;
    const asset = db.mediaAssets.find((a) => a.id === replaceId);
    if (!asset) return;
    const reader = new FileReader();
    reader.onload = () => {
      asset.name = file.name;
      asset.mimeType = file.type;
      asset.fileType = detectFileType(file.type);
      asset.sizeBytes = file.size;
      asset.dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
      asset.updatedAt = new Date().toISOString();
      appendAuditLog(db, user.id, 'update', 'media', replaceId);
      saveMockDatabase(db);
      refresh();
      setReplaceId(null);
      toast.success('File replaced');
    };
    reader.readAsDataURL(file);
  };

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
            <Button onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 me-2" />Upload File</Button>
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Folder className="h-4 w-4" />Folders</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {db.mediaFolders.map((f) => (
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
            {assets.map((asset) => (
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
          {assets.length === 0 && <p className="text-center text-muted-foreground py-8">{tc('noData')}</p>}
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
