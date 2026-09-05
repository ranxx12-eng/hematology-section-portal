'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Task } from '@/types';
import {
  getAllowedWorkflowActions,
  TASK_WORKFLOW_ACTION_LABELS,
  workflowActionRequiresComment,
  type TaskWorkflowAction,
} from '@/lib/tasks/workflow';
import { performTaskWorkflowAction } from '@/lib/clinical/task-workflow';

interface TaskWorkflowPanelProps {
  task: Task;
  employeeId?: string;
  canManage: boolean;
  canReview: boolean;
  canApprove: boolean;
  onComplete: () => void;
}

export function TaskWorkflowPanel({
  task,
  employeeId,
  canManage,
  canReview,
  canApprove,
  onComplete,
}: TaskWorkflowPanelProps) {
  const [pendingAction, setPendingAction] = useState<TaskWorkflowAction | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const actions = getAllowedWorkflowActions(task, {
    employeeId,
    canManage,
    canReview,
    canApprove,
  });

  if (actions.length === 0) return null;

  const submit = async (action: TaskWorkflowAction) => {
    if (workflowActionRequiresComment(action) && !comment.trim()) {
      toast.error('A comment or reason is required');
      return;
    }
    setSaving(true);
    const result = await performTaskWorkflowAction(task.id, action, comment.trim() || undefined);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Task updated');
    setPendingAction(null);
    setComment('');
    onComplete();
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Workflow Actions</p>
      {pendingAction ? (
        <div className="space-y-2">
          <Label>
            {workflowActionRequiresComment(pendingAction) ? 'Comment / reason *' : 'Comment (optional)'}
          </Label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder={workflowActionRequiresComment(pendingAction) ? 'Required…' : 'Optional…'}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => void submit(pendingAction)}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : TASK_WORKFLOW_ACTION_LABELS[pendingAction]}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setPendingAction(null); setComment(''); }}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action}
              size="sm"
              variant={action === 'reject' ? 'destructive' : 'outline'}
              onClick={() => {
                if (workflowActionRequiresComment(action)) {
                  setPendingAction(action);
                } else {
                  void submit(action);
                }
              }}
              disabled={saving}
            >
              {TASK_WORKFLOW_ACTION_LABELS[action]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
