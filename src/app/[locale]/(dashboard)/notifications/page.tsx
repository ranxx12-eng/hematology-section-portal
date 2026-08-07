'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { Bell, Check, Trash2, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog } from '@/lib/page-utils';
import { formatDateTime, downloadCSV, cn } from '@/lib/utils';
import type { Notification } from '@/types';
import type { NotificationPreference } from '@/types/modules';

export default function NotificationsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('notifications.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  const accessDenied = !can('notifications.view');


  useRouteReplace(accessDenied, `/${locale}/unauthorized`);


  if (accessDenied) return null;

  const prefs = useMemo(() => {
    const p = db.notificationPreferences.find((n) => n.userId === user?.id);
    return p ?? db.notificationPreferences[0];
  }, [db.notificationPreferences, user?.id]);

  const notifications = useMemo(() => {
    let list = db.notifications;
    if (user) list = list.filter((n) => n.userId === user.id || canManage);
    if (filter === 'unread') list = list.filter((n) => !n.isRead);
    if (typeFilter !== 'all') list = list.filter((n) => n.type.includes(typeFilter));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [db.notifications, user, filter, typeFilter, canManage]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markRead = (id: string) => {
    const notif = db.notifications.find((n) => n.id === id);
    if (notif) { notif.isRead = true; saveMockDatabase(db); refresh(); }
  };

  const markAllRead = () => {
    db.notifications.forEach((n) => { n.isRead = true; });
    if (user) appendAuditLog(db, user.id, 'update', 'notifications');
    saveMockDatabase(db);
    refresh();
    toast.success('All notifications marked as read');
  };

  const deleteNotification = (id: string) => {
    if (!canManage || !user) return;
    db.notifications = db.notifications.filter((n) => n.id !== id);
    appendAuditLog(db, user.id, 'delete', 'notifications', id);
    saveMockDatabase(db);
    refresh();
    toast.success('Notification deleted');
  };

  const updatePrefs = (key: keyof NotificationPreference, value: boolean) => {
    if (!user || !prefs) return;
    const idx = db.notificationPreferences.findIndex((n) => n.userId === user.id);
    const updated = { ...prefs, [key]: value };
    if (idx >= 0) db.notificationPreferences[idx] = updated;
    else db.notificationPreferences.push({ ...updated, userId: user.id });
    saveMockDatabase(db);
    refresh();
    toast.success('Preferences saved');
  };

  const typeVariant = (type: string) => {
    if (type.includes('due') || type.includes('maintenance')) return 'warning' as const;
    if (type.includes('low') || type.includes('critical') || type.includes('rejection')) return 'destructive' as const;
    return 'secondary' as const;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Notification Center</h1>
          <p className="text-muted-foreground">In-app alerts, reminders, and notification preferences</p>
        </div>
        <Button variant="outline" onClick={markAllRead} disabled={unreadCount === 0}>
          <Check className="h-4 w-4 me-2" />Mark All Read
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Unread</p><p className="text-2xl font-bold text-primary">{unreadCount}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Critical Alerts</p><p className="text-2xl font-bold text-destructive">{notifications.filter((n) => n.type.includes('critical')).length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Due Reminders</p><p className="text-2xl font-bold text-warning">{notifications.filter((n) => n.type.includes('due')).length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Maintenance</p><p className="text-2xl font-bold text-accent">{notifications.filter((n) => n.type.includes('maintenance')).length}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-4 w-4 me-1" />Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-4 mt-4">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap gap-2">
            {['all', 'critical', 'due', 'maintenance', 'rejection'].map((t) => (
              <Button key={t} size="sm" variant={typeFilter === t ? 'default' : 'outline'} onClick={() => setTypeFilter(t)} className="capitalize">{t}</Button>
            ))}
          </div>
          <div className="space-y-3">
            {notifications.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">{tc('noData')}</p>
            ) : notifications.map((n) => (
              <NotificationCard key={n.id} notification={n} locale={locale} typeVariant={typeVariant(n.type)} onMarkRead={() => markRead(n.id)} onDelete={canManage ? () => deleteNotification(n.id) : undefined} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          {prefs && (
            <Card>
              <CardHeader><CardTitle className="text-base">Notification Preferences</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {([
                  ['inApp', 'In-App Notifications'],
                  ['email', 'Email Notifications'],
                  ['criticalValues', 'Critical Value Alerts'],
                  ['sampleRejections', 'Sample Rejection Alerts'],
                  ['maintenanceReminders', 'Maintenance Reminders'],
                  ['dueDateReminders', 'Due Date Reminders'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <Label>{label}</Label>
                    <Switch checked={prefs[key]} onCheckedChange={(v) => updatePrefs(key, v)} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NotificationCard({ notification, locale, typeVariant, onMarkRead, onDelete }: {
  notification: Notification; locale: string; typeVariant: 'warning' | 'destructive' | 'secondary';
  onMarkRead: () => void; onDelete?: () => void;
}) {
  return (
    <Card className={cn(!notification.isRead && 'border-primary bg-primary/5')}>
      <CardContent className="flex items-start gap-4 py-4">
        <div className="rounded-full bg-muted p-2 shrink-0"><Bell className="h-4 w-4" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{notification.title}</p>
            <Badge variant={typeVariant}>{notification.type.replace(/_/g, ' ')}</Badge>
            {!notification.isRead && <Badge variant="default">New</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
          <p className="text-xs text-muted-foreground mt-2">{formatDateTime(notification.createdAt, locale)}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          {!notification.isRead && <Button size="sm" variant="ghost" onClick={onMarkRead}><Check className="h-4 w-4" /></Button>}
          {onDelete && <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
        </div>
      </CardContent>
    </Card>
  );
}
