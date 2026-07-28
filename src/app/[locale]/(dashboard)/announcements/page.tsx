'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Pin, Trash2, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog } from '@/lib/page-utils';
import { generateId } from '@/lib/utils';
import type { Announcement, AnnouncementType, AnnouncementPriority, TargetAudience } from '@/types/modules';

const TYPES: AnnouncementType[] = ['news', 'circular', 'alert', 'emergency', 'event'];
const PRIORITIES: AnnouncementPriority[] = ['low', 'normal', 'high', 'critical'];
const AUDIENCES: TargetAudience[] = ['all', 'supervisors', 'technologists', 'quality', 'management'];

export default function AnnouncementsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('announcements.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [filter, setFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', type: 'news' as AnnouncementType, priority: 'normal' as AnnouncementPriority, targetAudience: 'all' as TargetAudience, expiresAt: '', isPinned: false });
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  if (!can('announcements.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const items = useMemo(() => {
    const now = new Date();
    return db.announcements
      .filter((a) => a.isPublished)
      .filter((a) => filter === 'all' || a.type === filter)
      .filter((a) => !a.expiresAt || new Date(a.expiresAt) > now)
      .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
  }, [db.announcements, filter]);

  const priorityVariant = (p: AnnouncementPriority) => {
    if (p === 'critical') return 'destructive' as const;
    if (p === 'high') return 'warning' as const;
    return 'secondary' as const;
  };

  const publish = () => {
    if (!canManage || !user || !form.title) return;
    const ann: Announcement = {
      id: generateId(),
      title: form.title,
      content: form.content,
      type: form.type,
      priority: form.priority,
      targetAudience: form.targetAudience,
      expiresAt: form.expiresAt || undefined,
      isPinned: form.isPinned,
      isPublished: true,
      authorId: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.announcements.unshift(ann);
    appendAuditLog(db, user.id, 'create', 'announcements', ann.id);
    saveMockDatabase(db);
    refresh();
    setDialogOpen(false);
    setForm({ title: '', content: '', type: 'news', priority: 'normal', targetAudience: 'all', expiresAt: '', isPinned: false });
    toast.success('Announcement published');
  };

  const togglePin = (id: string) => {
    if (!canManage || !user) return;
    const ann = db.announcements.find((a) => a.id === id);
    if (ann) {
      ann.isPinned = !ann.isPinned;
      appendAuditLog(db, user.id, 'update', 'announcements', id);
      saveMockDatabase(db);
      refresh();
    }
  };

  const remove = (id: string) => {
    if (!canManage || !user || !confirm(tc('confirmDelete'))) return;
    db.announcements = db.announcements.filter((a) => a.id !== id);
    appendAuditLog(db, user.id, 'delete', 'announcements', id);
    saveMockDatabase(db);
    refresh();
    toast.success('Announcement deleted');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Announcement Center</h1>
          <p className="text-muted-foreground">News, circulars, alerts, and emergency notices</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />Publish</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New Announcement</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="space-y-2"><Label>Content</Label><Textarea rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as AnnouncementType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as AnnouncementPriority })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Target Audience</Label>
                    <Select value={form.targetAudience} onValueChange={(v) => setForm({ ...form, targetAudience: v as TargetAudience })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{AUDIENCES.map((a) => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Expiration Date</Label><Input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></div>
                </div>
                <div className="flex items-center gap-2"><Switch checked={form.isPinned} onCheckedChange={(v) => setForm({ ...form, isPinned: v })} /><Label>Pin to Dashboard</Label></div>
                <Button onClick={publish}>{tc('save')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger className="w-48"><SelectValue placeholder="Filter type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
        </SelectContent>
      </Select>

      <div className="space-y-4">
        {items.map((ann) => (
          <Card key={ann.id} className={ann.priority === 'critical' ? 'border-destructive' : ann.isPinned ? 'border-primary' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {ann.isPinned && <Badge><Pin className="h-3 w-3 me-1" />Pinned</Badge>}
                    <Badge variant="outline" className="capitalize">{ann.type}</Badge>
                    <Badge variant={priorityVariant(ann.priority)} className="capitalize">{ann.priority}</Badge>
                    <Badge variant="secondary" className="capitalize">{ann.targetAudience}</Badge>
                  </div>
                  <h3 className="text-lg font-semibold flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" />{ann.title}</h3>
                  <div className="text-sm mt-2 prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: ann.content.includes('<') ? ann.content : `<p>${ann.content}</p>` }} />
                  {ann.expiresAt && <p className="text-xs text-muted-foreground mt-2">Expires: {new Date(ann.expiresAt).toLocaleDateString()}</p>}
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => togglePin(ann.id)}><Pin className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => remove(ann.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
