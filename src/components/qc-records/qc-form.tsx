'use client';

import { useEffect, useState } from 'react';
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
import { QC_CORRECTIVE_ACTIONS, QC_FREQUENCIES, QC_FREQUENCY_LABELS, QC_IN_OUT_STATUSES, QC_RESOLUTION_STATUSES } from '@/lib/qc-records/constants';
import {
  isMalariaQcAParameter,
  isMalariaQcBParameter,
  isMalariaControlledQcParameter,
  MALARIA_QC_A_CONTROL_RESULTS,
  MALARIA_QC_B_CONTROL_RESULTS,
  malariaQcAStatusFromControlResult,
  type MalariaQcAControlResult,
} from '@/lib/qc-records/malaria-qc';
import { fetchActiveMalariaQcLots, type MalariaQcLotOption } from '@/lib/clinical/malaria-qc-lots';
import { formatDate } from '@/lib/utils';
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
  const [malariaLots, setMalariaLots] = useState<MalariaQcLotOption[]>([]);
  const [malariaLotsLoading, setMalariaLotsLoading] = useState(false);
  const [malariaLotsError, setMalariaLotsError] = useState<string | null>(null);

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
  const isMalariaA = isMalariaQcAParameter(form.parameter);
  const isMalariaB = isMalariaQcBParameter(form.parameter);
  const isMalaria = isMalariaControlledQcParameter(form.parameter);
  const isOut = form.qcStatus === 'OUT';
  const showOutParameterSelection = isAllParams && isOut && !isEditing;

  useEffect(() => {
    if (!isMalaria || isEditing) {
      setMalariaLots([]);
      setMalariaLotsError(null);
      return;
    }
    setMalariaLotsLoading(true);
    void fetchActiveMalariaQcLots(form.parameter).then((res) => {
      setMalariaLots(res.data);
      setMalariaLotsError(res.error);
      setMalariaLotsLoading(false);
    });
  }, [form.parameter, isMalaria, isEditing]);

  const selectedMalariaLot = malariaLots.find((lot) => lot.lotUsageId === form.malariaLotUsageId);

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
      malariaLotUsageId: undefined,
      malariaLotNumber: undefined,
      malariaLotExpiryDate: undefined,
      malariaControlLevel: undefined,
    });
  };

  const handleParameterChange = (parameter: string) => {
    setForm({
      ...form,
      parameter,
      level: '',
      outParameters: [],
      markAllOut: false,
      qcStatus: isMalariaQcBParameter(parameter) ? 'IN' : form.qcStatus,
      malariaLotUsageId: undefined,
      malariaLotNumber: undefined,
      malariaLotExpiryDate: undefined,
      malariaControlLevel: undefined,
    });
  };

  const handleMalariaLotChange = (lotUsageId: string) => {
    const lot = malariaLots.find((item) => item.lotUsageId === lotUsageId);
    setForm({
      ...form,
      malariaLotUsageId: lotUsageId,
      malariaLotNumber: lot?.lotNumber,
      malariaLotExpiryDate: lot?.expiryDate,
      malariaControlLevel: lot?.controlLevel,
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
    || (showOutParameterSelection && !outSelectionValid)
    || (isMalaria && !isEditing && !form.malariaLotUsageId);

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

      {isMalaria && !isEditing && (
        <div className="space-y-3 rounded-lg border p-4">
          <Label htmlFor="qc-malaria-lot">Malaria QC Lot *</Label>
          {malariaLotsLoading ? (
            <p className="text-sm text-muted-foreground">Loading active Malaria QC lots…</p>
          ) : malariaLotsError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{malariaLotsError}</p>
          ) : malariaLots.length === 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              No active Malaria QC lot is available. Please add or activate a lot first.
            </p>
          ) : (
            <>
              <Select
                value={form.malariaLotUsageId ?? ''}
                onValueChange={handleMalariaLotChange}
              >
                <SelectTrigger id="qc-malaria-lot"><SelectValue placeholder="Select active QC lot" /></SelectTrigger>
                <SelectContent>
                  {malariaLots.map((lot) => (
                    <SelectItem key={lot.lotUsageId} value={lot.lotUsageId}>
                      {lot.lotNumber} · {lot.itemName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedMalariaLot && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Lot number</p>
                    <p>{selectedMalariaLot.lotNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expiration date</p>
                    <p>{selectedMalariaLot.expiryDate ? formatDate(selectedMalariaLot.expiryDate) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Control level</p>
                    <p>{selectedMalariaLot.controlLevel ?? '—'}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div>
        <Label htmlFor="qc-level">
          {isMalariaB ? 'Control Result *' : `Level ${levelBlocked || isMalariaA ? '' : '*'}`}
        </Label>
        {isMalariaB ? (
          <div className="mt-2 grid gap-2">
            {MALARIA_QC_B_CONTROL_RESULTS.map((result) => (
              <label key={result} className="flex items-center gap-2 rounded-md border p-3 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="malaria-b-control-result"
                  checked={form.level === result}
                  onChange={() => setForm({ ...form, level: result, qcStatus: 'IN' })}
                />
                <span>{result}</span>
              </label>
            ))}
          </div>
        ) : isMalariaA ? (
          <p className="text-sm text-muted-foreground mt-1">Use Control Result below (Valid / Not Valid).</p>
        ) : levelBlocked ? (
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
        <Label htmlFor="qc-frequency">QC Frequency *</Label>
        <Select
          value={form.qcFrequency}
          onValueChange={(v) => setForm({ ...form, qcFrequency: v as QCRecordFormData['qcFrequency'] })}
          disabled={isEditing}
        >
          <SelectTrigger id="qc-frequency"><SelectValue placeholder="Select frequency" /></SelectTrigger>
          <SelectContent>
            {QC_FREQUENCIES.map((frequency) => (
              <SelectItem key={frequency} value={frequency}>{QC_FREQUENCY_LABELS[frequency]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isMalariaA ? (
        <div>
          <Label htmlFor="qc-malaria-a-result">Control Result *</Label>
          <Select
            value={form.qcStatus === 'OUT' ? 'Not Valid' : 'Valid'}
            onValueChange={(value) => setForm({
              ...form,
              qcStatus: malariaQcAStatusFromControlResult(value as MalariaQcAControlResult),
              correctiveActions: value === 'Valid' ? [] : form.correctiveActions,
              repeatQcStatus: value === 'Valid' ? undefined : form.repeatQcStatus,
              outParameters: value === 'Valid' ? [] : form.outParameters,
              markAllOut: value === 'Valid' ? false : form.markAllOut,
            })}
          >
            <SelectTrigger id="qc-malaria-a-result"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MALARIA_QC_A_CONTROL_RESULTS.map((result) => (
                <SelectItem key={result} value={result}>{result}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : !isMalariaB && (
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
      )}

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
    qcFrequency: record.qcFrequency,
    qcStatus: record.qcStatus,
    correctiveActions: record.correctiveActions as QCCorrectiveAction[],
    correctiveActionOther: record.correctiveActionOther ?? '',
    correctiveActionComment: record.correctiveActionComment ?? '',
    actionAt: actionLocal,
    repeatQcStatus: record.resolutionStatus,
    comment: record.comment ?? '',
    outParameters: [],
    markAllOut: false,
    malariaLotUsageId: undefined,
    malariaLotNumber: record.lotNumber,
    malariaLotExpiryDate: record.expiryDate,
    malariaControlLevel: record.level || undefined,
  };
}
