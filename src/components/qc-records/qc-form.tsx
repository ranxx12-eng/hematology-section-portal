'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  ALL_PARAMETERS,
  getLevelsForParameter,
  getParametersForInstrument,
  getSharedLevelsForInstrument,
  instrumentSupportsAllParameters,
  isAllParametersSelection,
  isLevelSelectionBlocked,
} from '@/lib/qc-records/config';
import { QC_CORRECTIVE_ACTIONS, QC_IN_OUT_STATUSES, QC_RESOLUTION_STATUSES } from '@/lib/qc-records/constants';
import type { QCRecordFormData } from '@/lib/qc-records/schema';
import type { QCCorrectiveAction } from '@/lib/qc-records/constants';

interface QCFormProps {
  form: QCRecordFormData;
  setForm: (form: QCRecordFormData) => void;
  instrumentOptions: { id: string; name: string }[];
  staffName: string;
  saving: boolean;
  onSave: () => void;
  saveLabel: string;
  isEditing?: boolean;
}

export function QCFormFields({
  form,
  setForm,
  instrumentOptions,
  staffName,
  saving,
  onSave,
  saveLabel,
  isEditing = false,
}: QCFormProps) {
  const selectedInstrument = instrumentOptions.find((i) => i.id === form.instrumentId);
  const instrumentName = selectedInstrument?.name ?? form.instrumentName;
  const parameters = instrumentName ? getParametersForInstrument(instrumentName) : [];
  const supportsAllParameters = instrumentName ? instrumentSupportsAllParameters(instrumentName) : false;
  const isAllParams = isAllParametersSelection(form.parameter);
  const levels = instrumentName && form.parameter
    ? (isAllParams
      ? getSharedLevelsForInstrument(instrumentName)
      : getLevelsForParameter(instrumentName, form.parameter))
    : [];
  const levelBlocked = instrumentName && form.parameter && !isAllParams
    ? isLevelSelectionBlocked(instrumentName, form.parameter)
    : false;
  const isOut = form.qcStatus === 'OUT';
  const showOutParameterSelection = isAllParams && isOut && !isEditing;

  const handleInstrumentChange = (instrumentId: string) => {
    const inst = instrumentOptions.find((i) => i.id === instrumentId);
    setForm({
      ...form,
      instrumentId,
      instrumentName: inst?.name ?? '',
      parameter: '',
      level: '',
      outParameters: [],
      markAllOut: false,
    });
  };

  const handleParameterChange = (parameter: string) => {
    setForm({
      ...form,
      parameter,
      level: '',
      outParameters: [],
      markAllOut: false,
    });
  };

  const toggleCorrectiveAction = (action: QCCorrectiveAction, checked: boolean) => {
    const next = checked
      ? [...form.correctiveActions, action]
      : form.correctiveActions.filter((a) => a !== action);
    setForm({ ...form, correctiveActions: next });
  };

  const toggleOutParameter = (parameter: string, checked: boolean) => {
    const next = checked
      ? [...form.outParameters, parameter]
      : form.outParameters.filter((p) => p !== parameter);
    setForm({
      ...form,
      outParameters: next,
      markAllOut: false,
    });
  };

  const handleMarkAllOut = (checked: boolean) => {
    setForm({
      ...form,
      markAllOut: checked,
      outParameters: checked ? parameters.map((p) => p.name) : [],
    });
  };

  const outSelectionValid = !showOutParameterSelection
    || form.markAllOut
    || form.outParameters.length > 0;

  const saveDisabled = saving
    || instrumentOptions.length === 0
    || levelBlocked
    || (parameters.length > 0 && !form.parameter)
    || (showOutParameterSelection && !outSelectionValid);

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pe-1">
      <div>
        <Label htmlFor="qc-instrument">Instrument *</Label>
        <Select value={form.instrumentId} onValueChange={handleInstrumentChange}>
          <SelectTrigger id="qc-instrument"><SelectValue placeholder="Select instrument" /></SelectTrigger>
          <SelectContent>
            {instrumentOptions.map(({ id, name }) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="qc-parameter">Parameter *</Label>
        <Select
          value={form.parameter}
          onValueChange={handleParameterChange}
          disabled={!form.instrumentId || isEditing}
        >
          <SelectTrigger id="qc-parameter"><SelectValue placeholder="Select parameter" /></SelectTrigger>
          <SelectContent>
            {supportsAllParameters && !isEditing && (
              <SelectItem value={ALL_PARAMETERS}>{ALL_PARAMETERS}</SelectItem>
            )}
            {parameters.map((param) => (
              <SelectItem key={param.name} value={param.name}>{param.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="qc-level">Level {levelBlocked ? '' : '*'}</Label>
        {levelBlocked ? (
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">Level configuration pending</p>
        ) : (
          <Select
            value={form.level}
            onValueChange={(level) => setForm({ ...form, level })}
            disabled={!form.parameter || levels.length === 0}
          >
            <SelectTrigger id="qc-level"><SelectValue placeholder="Select level" /></SelectTrigger>
            <SelectContent>
              {levels.map((level) => (
                <SelectItem key={level} value={level}>{level}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div>
        <Label htmlFor="qc-recorded">Date/Time *</Label>
        <Input
          id="qc-recorded"
          type="datetime-local"
          value={form.recordedAt}
          onChange={(e) => setForm({ ...form, recordedAt: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="qc-status">QC Status *</Label>
        <Select
          value={form.qcStatus}
          onValueChange={(v) => setForm({
            ...form,
            qcStatus: v as QCRecordFormData['qcStatus'],
            correctiveActions: v === 'IN' ? [] : form.correctiveActions,
            repeatQcStatus: v === 'IN' ? undefined : form.repeatQcStatus,
            outParameters: v === 'IN' ? [] : form.outParameters,
            markAllOut: v === 'IN' ? false : form.markAllOut,
          })}
        >
          <SelectTrigger id="qc-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            {QC_IN_OUT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                <span className={status === 'IN' ? 'text-emerald-600' : 'text-red-600'}>{status}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showOutParameterSelection && (
        <div className="space-y-3 rounded-lg border border-amber-200 dark:border-amber-900/50 p-4 bg-amber-50/50 dark:bg-amber-950/20">
          <p className="text-sm font-medium">Select OUT Parameter(s) *</p>
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <Checkbox
              checked={form.markAllOut}
              onCheckedChange={(checked) => handleMarkAllOut(checked === true)}
            />
            <span>Mark All as OUT</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {parameters.map((param) => (
              <label key={param.name} className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.markAllOut || form.outParameters.includes(param.name)}
                  disabled={form.markAllOut}
                  onCheckedChange={(checked) => toggleOutParameter(param.name, checked === true)}
                />
                <span>{param.name}</span>
              </label>
            ))}
          </div>
          {!outSelectionValid && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Select at least one OUT parameter or Mark All as OUT
            </p>
          )}
        </div>
      )}

      {isOut && (
        <div className="space-y-3 rounded-lg border border-red-200 dark:border-red-900/50 p-4 bg-red-50/50 dark:bg-red-950/20">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">Corrective Action *</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QC_CORRECTIVE_ACTIONS.map((action) => (
              <label key={action} className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.correctiveActions.includes(action)}
                  onCheckedChange={(checked) => toggleCorrectiveAction(action, checked === true)}
                />
                <span>{action}</span>
              </label>
            ))}
          </div>

          {form.correctiveActions.includes('Other') && (
            <div>
              <Label htmlFor="qc-corrective-other">Specify Corrective Action *</Label>
              <Input
                id="qc-corrective-other"
                value={form.correctiveActionOther ?? ''}
                onChange={(e) => setForm({ ...form, correctiveActionOther: e.target.value })}
              />
            </div>
          )}

          <div>
            <Label htmlFor="qc-corrective-comment">Corrective Action Comment</Label>
            <Textarea
              id="qc-corrective-comment"
              value={form.correctiveActionComment ?? ''}
              onChange={(e) => setForm({ ...form, correctiveActionComment: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="qc-action-at">Action Date/Time *</Label>
              <Input
                id="qc-action-at"
                type="datetime-local"
                value={form.actionAt ?? ''}
                onChange={(e) => setForm({ ...form, actionAt: e.target.value })}
              />
            </div>
            <div>
              <Label>Action Performed By</Label>
              <Input value={staffName} disabled />
            </div>
          </div>

          <div>
            <Label htmlFor="qc-repeat-status">Repeat QC Status *</Label>
            <Select
              value={form.repeatQcStatus ?? ''}
              onValueChange={(v) => setForm({ ...form, repeatQcStatus: v as QCRecordFormData['repeatQcStatus'] })}
            >
              <SelectTrigger id="qc-repeat-status"><SelectValue placeholder="Select repeat QC status" /></SelectTrigger>
              <SelectContent>
                {QC_RESOLUTION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="qc-comment">Comment</Label>
        <Textarea
          id="qc-comment"
          value={form.comment ?? ''}
          onChange={(e) => setForm({ ...form, comment: e.target.value })}
          rows={2}
        />
      </div>

      <Button onClick={onSave} className="w-full" disabled={saveDisabled}>
        {saveLabel}
      </Button>

      {instrumentOptions.length === 0 && (
        <p className="text-xs text-muted-foreground">
          QC instruments are not configured in the database. Run migration 012 or add instruments with the expected names.
        </p>
      )}
    </div>
  );
}

export function recordToForm(
  record: import('@/types').QCRecord,
  nameById: Record<string, string>,
): QCRecordFormData {
  const date = new Date(record.recordedAt);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const actionLocal = record.actionAt
    ? new Date(new Date(record.actionAt).getTime() - new Date(record.actionAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : local;

  return {
    instrumentId: record.instrumentId,
    instrumentName: nameById[record.instrumentId] ?? '',
    parameter: record.parameter,
    level: record.level,
    recordedAt: local,
    qcStatus: record.qcStatus,
    correctiveActions: record.correctiveActions as QCCorrectiveAction[],
    correctiveActionOther: record.correctiveActionOther ?? '',
    correctiveActionComment: record.correctiveActionComment ?? '',
    actionAt: actionLocal,
    repeatQcStatus: record.resolutionStatus,
    comment: record.comment ?? '',
    outParameters: [],
    markAllOut: false,
  };
}
