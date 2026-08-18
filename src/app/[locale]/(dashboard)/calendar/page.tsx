'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/components/providers/auth-provider';
import { createCalendarEvent, fetchCalendarEvents } from '@/lib/clinical/calendar-events';
import {
  CALENDAR_EVENT_TYPES,
  calendarEventFormSchema,
  emptyCalendarEventForm,
  type CalendarEventFormData,
} from '@/lib/calendar/schema';
import type { CalendarEvent, CalendarEventType } from '@/types/modules';

const TYPE_COLORS: Record<CalendarEventType, string> = {
  meeting: 'bg-primary/10 text-primary',
  training: 'bg-accent/10 text-accent',
  maintenance: 'bg-warning/10 text-warning',
  cap_visit: 'bg-secondary/30 text-foreground',
  cbahi: 'bg-primary/20 text-primary',
  holiday: 'bg-success/10 text-success',
  staff_schedule: 'bg-muted text-muted-foreground',
};

export default function CalendarPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('calendar.manage');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [cursor, setCursor] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CalendarEventFormData>(() => emptyCalendarEventForm());

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchCalendarEvents();
    setEvents(result.data);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const accessDenied = !can('calendar.view');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  const filteredEvents = useMemo(
    () => events.filter((e) => typeFilter === 'all' || e.type === typeFilter),
    [events, typeFilter],
  );

  const monthDays = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const days: Date[] = [];
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
    return { first, last, days, label: first.toLocaleDateString(locale, { month: 'long', year: 'numeric' }) };
  }, [cursor, locale]);

  const eventsForDay = (day: Date) => filteredEvents.filter((e) => new Date(e.startDate).toDateString() === day.toDateString());

  const weekDays = useMemo(() => {
    const start = new Date(cursor);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [cursor]);

  const addEvent = async () => {
    if (!canManage || !user) return;
    const parsed = calendarEventFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid form');
      return;
    }
    setSaving(true);
    const result = await createCalendarEvent(user.id, parsed.data);
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to add event');
      return;
    }
    setDialogOpen(false);
    setForm(emptyCalendarEventForm());
    toast.success('Event added');
    void loadEvents();
  };

  const EventList = ({ dayEvents }: { dayEvents: CalendarEvent[] }) => (
    <div className="space-y-1 mt-1">
      {dayEvents.slice(0, 3).map((e) => (
        <div key={e.id} className={`text-xs rounded px-1.5 py-0.5 truncate ${TYPE_COLORS[e.type]}`}>{e.title}</div>
      ))}
      {dayEvents.length > 3 && <p className="text-xs text-muted-foreground">+{dayEvents.length - 3} more</p>}
    </div>
  );

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
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-muted-foreground">Meetings, trainings, maintenance, audits, and schedules</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />Add Event</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Event</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="space-y-2"><Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as CalendarEventFormData['type'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CALENDAR_EVENT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace('_', ' ')}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Start</Label><Input type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
                  <div className="space-y-2"><Label>End</Label><Input type="datetime-local" value={form.endDate ?? ''} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Location</Label><Input value={form.location ?? ''} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                <Button onClick={addEvent} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tc('save')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {error && <EmptyState title="Failed to load events" description={error} />}

      <div className="flex flex-wrap items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {CALENDAR_EVENT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ms-auto">
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium min-w-32 text-center">{monthDays.label}</span>
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <TabsList>
          <TabsTrigger value="month">Monthly</TabsTrigger>
          <TabsTrigger value="week">Weekly</TabsTrigger>
          <TabsTrigger value="day">Daily</TabsTrigger>
        </TabsList>

        <TabsContent value="month" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground pb-2">{d}</div>
                ))}
                {Array.from({ length: monthDays.first.getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
                {monthDays.days.map((day) => {
                  const dayEvents = eventsForDay(day);
                  const isToday = day.toDateString() === new Date().toDateString();
                  return (
                    <div key={day.toISOString()} className={`min-h-24 rounded-lg border p-2 ${isToday ? 'border-primary bg-primary/5' : 'border-border'}`}>
                      <p className={`text-sm font-medium ${isToday ? 'text-primary' : ''}`}>{day.getDate()}</p>
                      <EventList dayEvents={dayEvents} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="week" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
            {weekDays.map((day) => (
              <Card key={day.toISOString()}>
                <CardHeader className="pb-2"><CardTitle className="text-sm">{day.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {eventsForDay(day).map((e) => (
                    <div key={e.id} className={`rounded-lg p-2 text-xs ${TYPE_COLORS[e.type]}`}>
                      <p className="font-medium">{e.title}</p>
                      <p>{new Date(e.startDate).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="day" className="mt-4">
          <Card>
            <CardHeader><CardTitle>{cursor.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {eventsForDay(cursor).map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-lg border border-border p-4">
                  <Badge className={TYPE_COLORS[e.type]} variant="outline">{e.type.replace('_', ' ')}</Badge>
                  <div>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-sm text-muted-foreground">{new Date(e.startDate).toLocaleTimeString()} — {e.location ?? 'No location'}</p>
                  </div>
                </div>
              ))}
              {eventsForDay(cursor).length === 0 && <p className="text-muted-foreground text-center py-8">{tc('noData')}</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
