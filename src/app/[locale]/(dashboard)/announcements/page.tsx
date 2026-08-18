'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Pin, Trash2, Megaphone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/components/providers/auth-provider';
import {
  createAnnouncement,
  fetchAnnouncements,
  softDeleteAnnouncement,
  updateAnnouncementPinned,
} from '@/lib/clinical/announcements';
import {
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_TYPES,
  TARGET_AUDIENCES,
  announcementFormSchema,
  emptyAnnouncementForm,
  type AnnouncementFormData,
} from '@/lib/announcements/schema';
import type { Announcement, AnnouncementPriority } from '@/types/modules';

export default function AnnouncementsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('announcements.manage');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AnnouncementFormData>(() => emptyAnnouncementForm());

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchAnnouncements();
    setAnnouncements(result.data);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  const accessDenied = !can('announcements.view');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  const items = useMemo(() => {
    const now = new Date();
    return announcements
      .filter((a) => a.isPublished)
      .filter((a) => filter === 'all' || a.type === filter)
      .filter((a) => !a.expiresAt || new Date(a.expiresAt) > now)
      .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
  }, [announcements, filter]);

  const priorityVariant = (p: AnnouncementPriority) => {
    if (p === 'critical') return 'destructive' as const;
    if (p === 'high') return 'warning' as const;
    return 'secondary' as const;
  };

  const publish = async () => {
    if (!canManage || !user) return;
    const parsed = announcementFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid form');
      return;
    }
    setSaving(true);
    const result = await createAnnouncement(user.id, parsed.data);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to publish announcement');
      return;
    }
    setDialogOpen(false);
    setForm(emptyAnnouncementForm());
    toast.success('Announcement published');
    void loadAnnouncements();
  };

  const togglePin = async (id: string, current: boolean) => {
    if (!canManage || !user) return;
    const result = await updateAnnouncementPinned(id, !current, user.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    void loadAnnouncements();
  };

  const remove = async (id: string) => {
    if (!canManage || !user || !confirm(tc('confirmDelete'))) return;
    const result = await softDeleteAnnouncement(id, user.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Announcement deleted');
    void loadAnnouncements();
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
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as AnnouncementFormData['type'] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ANNOUNCEMENT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as AnnouncementFormData['priority'] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ANNOUNCEMENT_PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Target Audience</Label>
                    <Select value={form.targetAudience} onValueChange={(v) => setForm({ ...form, targetAudience: v as AnnouncementFormData['targetAudience'] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TARGET_AUDIENCES.map((a) => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Expiration Date</Label><Input type="date" value={form.expiresAt ?? ''} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></div>
                </div>
                <div className="flex items-center gap-2"><Switch checked={form.isPinned} onCheckedChange={(v) => setForm({ ...form, isPinned: v })} /><Label>Pin to Dashboard</Label></div>
                <Button onClick={publish} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tc('save')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger className="w-48"><SelectValue placeholder="Filter type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {ANNOUNCEMENT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
        </SelectContent>
      </Select>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <EmptyState title="Failed to load announcements" description={error} />
      ) : (
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
                      <Button size="sm" variant="outline" onClick={() => togglePin(ann.id, ann.isPinned)}><Pin className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => remove(ann.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && <EmptyState title={tc('noData')} description="No active announcements match your filters." />}
        </div>
      )}
    </div>
  );
}
