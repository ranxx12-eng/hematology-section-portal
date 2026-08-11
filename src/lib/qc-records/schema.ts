import { z } from 'zod';
import {
  ALL_PARAMETERS,
  canSaveParameter,
  getParameterConfig,
  getParametersForInstrument,
  instrumentSupportsAllParameters,
  isAllParametersSelection,
  isValidAllParametersLevel,
  isValidInstrumentParameterLevel,
} from './config';
import {
  QC_CORRECTIVE_ACTIONS,
  QC_IN_OUT_STATUSES,
  QC_RESOLUTION_STATUSES,
} from './constants';

export const qcRecordFormSchema = z.object({
  instrumentId: z.string().min(1, 'Instrument is required'),
  instrumentName: z.string().min(1, 'Instrument is required'),
  parameter: z.string().min(1, 'Parameter is required'),
  level: z.string(),
  recordedAt: z.string().min(1, 'Date/time is required'),
  qcStatus: z.enum(QC_IN_OUT_STATUSES),
  correctiveActions: z.array(z.enum(QC_CORRECTIVE_ACTIONS)).default([]),
  correctiveActionOther: z.string().optional(),
  correctiveActionComment: z.string().optional(),
  actionAt: z.string().optional(),
  repeatQcStatus: z.enum(QC_RESOLUTION_STATUSES).optional(),
  comment: z.string().optional(),
  outParameters: z.array(z.string()).default([]),
  markAllOut: z.boolean().default(false),
}).superRefine((data, ctx) => {
  const isAllParams = isAllParametersSelection(data.parameter);

  if (isAllParams) {
    if (!instrumentSupportsAllParameters(data.instrumentName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'All Parameters is not supported for this instrument',
        path: ['parameter'],
      });
      return;
    }

    if (!data.level) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Level is required',
        path: ['level'],
      });
    } else if (!isValidAllParametersLevel(data.instrumentName, data.level)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid level for this instrument',
        path: ['level'],
      });
    }
  } else {
    if (!canSaveParameter(data.instrumentName, data.parameter)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Level configuration pending for this parameter',
        path: ['parameter'],
      });
      return;
    }

    const paramConfig = getParameterConfig(data.instrumentName, data.parameter);

    if (paramConfig?.levelRequired && !data.level) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Level is required',
        path: ['level'],
      });
    }

    if (
      data.level
      && !isValidInstrumentParameterLevel(data.instrumentName, data.parameter, data.level)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid level for this instrument and parameter',
        path: ['level'],
      });
    }
  }

  if (data.qcStatus === 'OUT') {
    if (isAllParams) {
      const activeParams = getParametersForInstrument(data.instrumentName).map((p) => p.name);
      const effectiveOut = data.markAllOut ? activeParams : data.outParameters;
      if (effectiveOut.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select at least one OUT parameter or Mark All as OUT',
          path: ['outParameters'],
        });
      }
    }

    if (data.correctiveActions.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one corrective action',
        path: ['correctiveActions'],
      });
    }
    if (data.correctiveActions.includes('Other') && !data.correctiveActionOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Specify corrective action when Other is selected',
        path: ['correctiveActionOther'],
      });
    }
    if (!data.actionAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Action date/time is required',
        path: ['actionAt'],
      });
    }
    if (!data.repeatQcStatus) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Repeat QC status is required',
        path: ['repeatQcStatus'],
      });
    }
  }
});

export type QCRecordFormData = z.infer<typeof qcRecordFormSchema>;

export function emptyQCRecordForm(): QCRecordFormData {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return {
    instrumentId: '',
    instrumentName: '',
    parameter: '',
    level: '',
    recordedAt: local,
    qcStatus: 'IN',
    correctiveActions: [],
    correctiveActionOther: '',
    correctiveActionComment: '',
    actionAt: local,
    repeatQcStatus: undefined,
    comment: '',
    outParameters: [],
    markAllOut: false,
  };
}

export function formatCorrectiveActionsSummary(
  actions: string[],
  other?: string,
): string {
  const labels = actions.map((a) => (a === 'Other' && other?.trim() ? `Other: ${other.trim()}` : a));
  return labels.join(', ');
}

export function deriveResolutionDisplay(
  qcStatus: 'IN' | 'OUT',
  resolutionStatus?: 'IN' | 'Still OUT' | 'Pending' | null,
): 'N/A' | 'Resolved' | 'Still OUT' | 'Pending' | 'Unresolved' {
  if (qcStatus === 'IN') return 'N/A';
  if (resolutionStatus === 'IN') return 'Resolved';
  if (resolutionStatus === 'Still OUT') return 'Still OUT';
  if (resolutionStatus === 'Pending') return 'Pending';
  return 'Unresolved';
}

export function isUnresolvedOut(
  qcStatus: 'IN' | 'OUT',
  resolutionStatus?: 'IN' | 'Still OUT' | 'Pending' | null,
): boolean {
  return qcStatus === 'OUT' && resolutionStatus !== 'IN';
}
