'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Bell, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { appendAuditLog } from '@/lib/page-utils';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types';

export default function NotificationsPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const canManage = can('notifications.manage');
  const [db, setDb] = useState(() => getMockDatabase());
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const refresh = useCallback(() => setDb(getMockDatabase()), []);

  if (!can('notifications.view')) {
    router.replace(`/${locale}/unauthorized`);
    return null;
  }

  const notifications = useMemo(() => {
    let list = db.notifications;
    if (user) list = list.filter((n) => n.userId === user.id || canManage);
    if (filter === 'unread') list = list.filter((n) => !n.isRead);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [db.notifications, user, filter, canManage]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markRead = (id: string) => {
    const notif = db.notifications.find((n) => n.id === id);
    if (notif) {
      notif.isRead = true;
      saveMockDatabase(db);
      refresh();
    }
  };

  const markAllRead = () => {
    db.notifications.forEach((n) => { n.isRead = true; });
    if (user) appendAuditLog(db, user.id, 'update', 'notifications');
    saveMockDatabase(db);
    refresh();
    toast.success('All notifications marked as read');
  };

  const deleteNotification = (id: string) => {
    if (!canManage) return;
    db.notifications = db.notifications.filter((n) => n.id !== id);
    if (user) appendAuditLog(db, user.id, 'delete', 'notifications', id);
    saveMockDatabase(db);
    refresh();
    toast.success('Notification deleted');
  };

  const typeVariant = (type: string) => {
    if (type.includes('due') || type.includes('maintenance')) return 'warning' as const;
    if (type.includes('low') || type.includes('critical')) return 'destructive' as const;
    return 'secondary' as const;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('notifications')}</h1>
          <p className="text-muted-foreground">{unreadCount} unread notification(s)</p>
        </div>
        <Button variant="outline" onClick={markAllRead} disabled={unreadCount === 0}>
          <Check className="h-4 w-4 me-2" />Mark All Read
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
        </TabsList>
        <TabsContent value={filter} className="space-y-3 mt-4">
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">{tc('noData')}</p>
          ) : (
            notifications.map((n) => (
              <NotificationCard
                key={n.id}
                notification={n}
                locale={locale}
                typeVariant={typeVariant(n.type)}
                onMarkRead={() => markRead(n.id)}
                onDelete={canManage ? () => deleteNotification(n.id) : undefined}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NotificationCard({
  notification, locale, typeVariant, onMarkRead, onDelete,
}: {
  notification: Notification;
  locale: string;
  typeVariant: 'warning' | 'destructive' | 'secondary';
  onMarkRead: () => void;
  onDelete?: () => void;
}) {
  return (
    <Card className={cn(!notification.isRead && 'border-medical-blue bg-medical-blue/5')}>
      <CardContent className="flex items-start gap-4 py-4">
        <div className="rounded-full bg-muted p-2 shrink-0">
          <Bell className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{notification.title}</p>
            <Badge variant={typeVariant}>{notification.type.replace('_', ' ')}</Badge>
            {!notification.isRead && <Badge variant="default">New</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
          <p className="text-xs text-muted-foreground mt-2">{formatDateTime(notification.createdAt, locale)}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          {!notification.isRead && (
            <Button size="sm" variant="ghost" onClick={onMarkRead}><Check className="h-4 w-4" /></Button>
          )}
          {onDelete && (
            <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-red-500" /></Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
