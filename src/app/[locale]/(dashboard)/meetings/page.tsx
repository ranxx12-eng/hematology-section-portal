'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/components/providers/auth-provider';
import { formatDate } from '@/lib/utils';
import {
  createMeeting,
  fetchMeetings,
  softDeleteMeeting,
} from '@/lib/clinical/meetings';
import { fetchProfileNameMap } from '@/lib/clinical/employees';
import {
  emptyMeetingForm,
  meetingFormSchema,
  type MeetingFormData,
} from '@/lib/meetings/schema';
import type { Meeting } from '@/types';

export default function MeetingsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('meetings.manage');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [organizerNames, setOrganizerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<MeetingFormData>(() => emptyMeetingForm());

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [meetingsResult, names] = await Promise.all([
      fetchMeetings(),
      fetchProfileNameMap(),
    ]);
    setMeetings(meetingsResult.data);
    setOrganizerNames(names);
    setError(meetingsResult.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  const accessDenied = !can('meetings.view');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  const addMeeting = async () => {
    if (!canManage || !user) return;
    const parsed = meetingFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid form');
      return;
    }
    setSaving(true);
    const result = await createMeeting(user.id, parsed.data);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to schedule meeting');
      return;
    }
    setDialogOpen(false);
    setForm(emptyMeetingForm());
    toast.success('Meeting scheduled');
    void loadMeetings();
  };

  const deleteMeeting = async (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    const result = await softDeleteMeeting(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Meeting deleted');
    void loadMeetings();
  };

  const getOrganizerName = (id: string) => organizerNames[id] ?? id;

  const columns: ColumnDef<Meeting>[] = useMemo(() => [
    { accessorKey: 'title', header: 'Title' },
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => formatDate(row.original.date, locale) },
    { accessorKey: 'time', header: 'Time' },
    { accessorKey: 'location', header: 'Location' },
    { accessorKey: 'organizerId', header: 'Organizer', cell: ({ row }) => getOrganizerName(row.original.organizerId) },
    { accessorKey: 'minutesApproved', header: 'Minutes', cell: ({ row }) => row.original.minutesApproved ? <Badge variant="success">Approved</Badge> : <Badge variant="secondary">Pending</Badge> },
    {
      id: 'actions', header: tc('actions'),
      cell: ({ row }) => canManage ? (
        <Button size="sm" variant="ghost" onClick={() => deleteMeeting(row.original.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
      ) : null,
    },
  ], [canManage, locale, tc, organizerNames]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('meetings')}</h1>
          <p className="text-muted-foreground">{meetings.length} meetings</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />{tc('add')}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Schedule Meeting</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                  <div><Label>Time</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
                </div>
                <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                <div><Label>Agenda</Label><Input value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} /></div>
                <Button onClick={addMeeting} className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tc('save')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <EmptyState title="Failed to load meetings" description={error} />
      ) : meetings.length === 0 ? (
        <EmptyState title={tc('noData')} description="No meetings scheduled." />
      ) : (
        <DataTable data={meetings} columns={columns} searchKey="title" searchPlaceholder="Search meetings..." />
      )}
    </div>
  );
}
