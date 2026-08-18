'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { Bell, Check, Trash2, Settings, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/empty-state';
import { useAuth } from '@/components/providers/auth-provider';
import { formatDateTime, cn } from '@/lib/utils';
import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/clinical/notifications';
import type { Notification } from '@/types';

export default function NotificationsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { can, user } = useAuth();
  const canManage = can('notifications.manage');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const result = await fetchNotifications(user.id);
    setNotifications(result.data);
    setError(result.error);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const accessDenied = !can('notifications.view');

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied) return null;

  const filtered = useMemo(() => {
    let list = notifications;
    if (filter === 'unread') list = list.filter((n) => !n.isRead);
    if (typeFilter !== 'all') list = list.filter((n) => n.type.includes(typeFilter));
    return list;
  }, [notifications, filter, typeFilter]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markRead = async (id: string) => {
    const result = await markNotificationRead(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    void loadNotifications();
  };

  const markAllRead = async () => {
    if (!user) return;
    const result = await markAllNotificationsRead(user.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('All notifications marked as read');
    void loadNotifications();
  };

  const removeNotification = async (id: string) => {
    if (!canManage) return;
    const result = await deleteNotification(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Notification deleted');
    void loadNotifications();
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
          <p className="text-muted-foreground">In-app alerts and reminders</p>
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
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : error ? (
            <EmptyState title="Failed to load notifications" description={error} />
          ) : (
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <EmptyState title={tc('noData')} description="No notifications match your filters." />
              ) : filtered.map((n) => (
                <NotificationCard key={n.id} notification={n} locale={locale} typeVariant={typeVariant(n.type)} onMarkRead={() => markRead(n.id)} onDelete={canManage ? () => removeNotification(n.id) : undefined} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <EmptyState title="Preferences unavailable" description="Notification preference storage is not yet configured in the production schema." />
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
