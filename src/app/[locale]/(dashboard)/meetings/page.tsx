'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog } from '@/lib/page-utils';
import { formatDate, generateId } from '@/lib/utils';
import type { Meeting } from '@/types';

export default function MeetingsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('meetings.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', time: '10:00', location: '', agenda: '' });
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  const accessDenied = !can('meetings.view');


  useRouteReplace(accessDenied, `/${locale}/unauthorized`);


  if (accessDenied) return null;

  const addMeeting = () => {
    if (!form.title || !canManage) return;
    const now = new Date().toISOString();
    const meeting: Meeting = {
      id: generateId(),
      title: form.title,
      date: form.date || now,
      time: form.time,
      location: form.location || 'Conference Room A',
      organizerId: user?.id || db.employees[0]?.id || '',
      agenda: form.agenda,
      minutesApproved: false,
      createdAt: now,
    };
    db.meetings.unshift(meeting);
    if (user) appendAuditLog(db, user.id, 'create', 'meetings', meeting.id);
    saveMockDatabase(db);
    refresh();
    setDialogOpen(false);
    toast.success('Meeting scheduled');
  };

  const deleteMeeting = (id: string) => {
    if (!canManage || !confirm(tc('confirmDelete'))) return;
    db.meetings = db.meetings.filter((m) => m.id !== id);
    if (user) appendAuditLog(db, user.id, 'delete', 'meetings', id);
    saveMockDatabase(db);
    refresh();
    toast.success('Meeting deleted');
  };

  const getOrganizerName = (id: string) => db.employees.find((e) => e.id === id)?.fullName ?? id;

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
  ], [canManage, locale, tc, db.employees]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('meetings')}</h1>
          <p className="text-muted-foreground">{db.meetings.length} meetings scheduled</p>
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
                <Button onClick={addMeeting} className="w-full">{tc('save')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <DataTable data={db.meetings} columns={columns} searchKey="title" searchPlaceholder="Search meetings..." />
    </div>
  );
}
