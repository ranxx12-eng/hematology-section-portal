'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { WorkflowQueueTable } from '@/components/review/workflow-queue-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { fetchEmployeeNameMap, fetchTasks } from '@/lib/clinical/tasks';
import {
  canApproveTasks,
  filterTasksForApprovalCenter,
  taskToReviewQueueItem,
  type ReviewQueueItem,
} from '@/lib/tasks/workflow';

export default function ApprovalCenterPage() {
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewQueueItem[]>([]);

  const canAccess = user?.role ? canApproveTasks(user.role, can) : false;
  useRouteReplace(!canAccess, `/${locale}/unauthorized`);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [tasksResult, nameMap] = await Promise.all([fetchTasks(), fetchEmployeeNameMap()]);
    if (tasksResult.error) {
      setError(tasksResult.error);
      setItems([]);
    } else {
      const pending = filterTasksForApprovalCenter(tasksResult.data);
      setItems(pending.map((t) => taskToReviewQueueItem(t, nameMap, locale)));
    }
    setLoading(false);
  }, [locale]);

  useEffect(() => {
    if (canAccess) void load();
  }, [canAccess, load]);

  const pendingCount = useMemo(() => items.length, [items]);

  if (!canAccess) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-7 w-7" />
            Approval Center
          </h1>
          <p className="text-muted-foreground">Records waiting for final approval</p>
        </div>
        <Badge variant="warning" className="text-base px-3 py-1">
          {pendingCount} pending approval
        </Badge>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Tasks</p>
            <p className="text-2xl font-bold">{pendingCount}</p>
          </CardContent>
        </Card>
      </div>

      <WorkflowQueueTable
        items={items}
        locale={locale}
        mode="approval"
        loading={loading}
        error={error}
        onReview={(item) => router.push(item.href)}
      />
    </div>
  );
}
