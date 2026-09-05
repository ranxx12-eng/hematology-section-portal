'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { type ColumnDef } from '@tanstack/react-table';
import { AlertCircle } from 'lucide-react';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { statusBadgeVariant } from '@/lib/page-utils';
import { TASK_PRIORITIES } from '@/lib/tasks/schema';
import { TASK_STATUS_LABELS, type ReviewQueueItem } from '@/lib/tasks/workflow';
import { formatDate, formatDateTime } from '@/lib/utils';

interface WorkflowQueueTableProps {
  items: ReviewQueueItem[];
  locale: string;
  mode: 'review' | 'approval';
  loading?: boolean;
  error?: string | null;
  onReview?: (item: ReviewQueueItem) => void;
}

export function WorkflowQueueTable({
  items,
  locale,
  mode,
  loading = false,
  error = null,
  onReview,
}: WorkflowQueueTableProps) {
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');

  const filtered = useMemo(() => items.filter((item) => {
    if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;
    if (moduleFilter !== 'all' && item.moduleType !== moduleFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!item.title.toLowerCase().includes(q)
        && !item.assigneeNames.toLowerCase().includes(q)
        && !item.referenceNumber.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  }), [items, search, priorityFilter, moduleFilter]);

  const columns: ColumnDef<ReviewQueueItem>[] = useMemo(() => [
    {
      id: 'module',
      header: 'Module',
      cell: ({ row }) => <Badge variant="secondary">{row.original.moduleType}</Badge>,
    },
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <div className="space-y-1">
          <Link href={row.original.href} className="font-medium hover:underline">
            {row.original.title}
          </Link>
          <p className="text-xs text-muted-foreground">{row.original.referenceNumber}</p>
        </div>
      ),
    },
    {
      accessorKey: 'assigneeNames',
      header: 'Assigned',
    },
    {
      accessorKey: 'submittedAt',
      header: mode === 'review' ? 'Submitted' : 'Reviewed',
      cell: ({ row }) => formatDateTime(row.original.submittedAt, locale),
    },
    {
      accessorKey: 'dueDate',
      header: 'Due',
      cell: ({ row }) => (
        <span className={row.original.overdue ? 'text-destructive font-medium' : ''}>
          {formatDate(row.original.dueDate, locale)}
          {row.original.overdue && (
            <AlertCircle className="inline h-3.5 w-3.5 ms-1" aria-label="Overdue" />
          )}
        </span>
      ),
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => (
        <Badge variant={statusBadgeVariant(row.original.priority)}>{row.original.priority}</Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={statusBadgeVariant(row.original.status)}>
          {TASK_STATUS_LABELS[row.original.status]}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={row.original.href}>Open</Link>
          </Button>
          {onReview && (
            <Button size="sm" onClick={() => onReview(row.original)}>
              {mode === 'review' ? 'Review' : 'Approve'}
            </Button>
          )}
        </div>
      ),
    },
  ], [locale, mode, onReview]);

  if (loading) {
    return <EmptyState title="Loading…" description="Fetching queue items." />;
  }

  if (error) {
    return <EmptyState title="Failed to load queue" description={error} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search title, assignee, reference…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Module" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            <SelectItem value="task">Tasks</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title={mode === 'review' ? 'No items pending review' : 'No items pending approval'}
          description="New submissions will appear here."
        />
      ) : (
        <DataTable data={filtered} columns={columns} searchKey="title" />
      )}
    </div>
  );
}
