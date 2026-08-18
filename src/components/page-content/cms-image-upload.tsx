'use client';

import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { uploadCmsImage } from '@/lib/clinical/page-content';
import type { PageContentKey } from '@/lib/page-content/constants';

interface CmsImageUploadFieldProps {
  label: string;
  pageKey: PageContentKey;
  userId: string;
  value?: string | null;
  previewUrl?: string | null;
  onChange: (storagePath: string, assetId: string | null) => void;
}

export function CmsImageUploadField({
  label,
  pageKey,
  userId,
  previewUrl,
  onChange,
}: CmsImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayUrl = previewUrl || null;

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    const result = await uploadCmsImage(pageKey, file, userId);
    setUploading(false);
    if (result.error || !result.data) {
      setError(result.error ?? 'Upload failed');
      return;
    }
    onChange(result.data.storagePath, result.data.assetId);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {displayUrl ? (
        <div className="relative overflow-hidden rounded-lg border border-border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displayUrl} alt={label} className="h-32 w-full object-cover" />
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
          No image selected
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Upload className="h-4 w-4 me-2" />}
        Upload Image
      </Button>
    </div>
  );
}
