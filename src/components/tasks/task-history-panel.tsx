'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchTaskWorkflowHistory } from '@/lib/clinical/task-workflow';
import { TASK_STATUS_LABELS, type TaskWorkflowHistoryEntry } from '@/lib/tasks/workflow';
import { formatDateTime } from '@/lib/utils';

interface TaskHistoryPanelProps {
  taskId: string;
  nameMap: Record<string, string>;
}

export function TaskHistoryPanel({ taskId, nameMap }: TaskHistoryPanelProps) {
  const [entries, setEntries] = useState<TaskWorkflowHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchTaskWorkflowHistory(taskId, nameMap).then((res) => {
      setEntries(res.data);
      setError(res.error);
      setLoading(false);
    });
  }, [taskId, nameMap]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No workflow history yet.</p>;
  }

  return (
    <ol className="space-y-3 border-s ps-4">
      {entries.map((entry) => (
        <li key={entry.id} className="text-sm">
          <p className="font-medium capitalize">{entry.action.replace(/_/g, ' ')}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(entry.createdAt)}
            {entry.performerName || entry.performerRole
              ? ` · ${entry.performerName ?? entry.performerRole}`
              : ''}
          </p>
          {entry.previousStatus && entry.previousStatus !== entry.newStatus && (
            <p className="text-xs">
              {TASK_STATUS_LABELS[entry.previousStatus]} → {TASK_STATUS_LABELS[entry.newStatus]}
            </p>
          )}
          {entry.comment && (
            <p className="mt-1 text-muted-foreground">{entry.comment}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
