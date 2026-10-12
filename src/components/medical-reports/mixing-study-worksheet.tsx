'use client';

import { useMemo, useState } from 'react';
import {
  MIXING_STUDY_STATUS_LABELS,
  ROSNER_FORMULA,
  ROSNER_THRESHOLD_STATEMENT,
  formatMixingStaffLine,
  type MixingTestSelection,
} from '@/lib/medical-reports/form-hema-023/constants';
import { calculateRosnerIndex, formatRosnerIndexDisplay } from '@/lib/medical-reports/form-hema-023/rosner';
import {
  mixingStudyHasErrors,
  validateMixingStudy,
  type MixingSectionInput,
  type MixingStudyDraftInput,
  type MixingStudyFieldErrors,
} from '@/lib/medical-reports/form-hema-023/validation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { MixingStudy, MixingStudyResult } from '@/types/mixing-study';

interface MixingStudyWorksheetProps {
  study: MixingStudy;
  saving: boolean;
  serverMessage?: string | null;
  onSave: (input: MixingStudyDraftInput) => void;
  onSubmit: (input: MixingStudyDraftInput) => void;
  onReview: (comment: string) => void;
  onRequestChanges: (comment: string) => void;
}

function sectionFromResult(result?: MixingStudyResult): MixingSectionInput {
  return {
    patientClottingTime: result?.patientClottingTime ?? '',
    nppClottingTime: result?.nppClottingTime ?? '',
    targetValue: result?.targetValue ?? '',
    immediateMixClottingTime: result?.immediateMixClottingTime ?? '',
    incubatedMixClottingTime: result?.incubatedMixClottingTime ?? '',
    conclusion: result?.conclusion ?? '',
  };
}

function liveIndex(patient: string, npp: string, mix: string): string {
  const result = calculateRosnerIndex(patient, npp, mix);
  if (result.status === 'invalid') return 'Clotting times must be positive';
  if (!result.index) return result.interpretation;
  return `${formatRosnerIndexDisplay(result.index)} — ${result.interpretation}`;
}

export function MixingStudyWorksheet({
  study,
  saving,
  serverMessage,
  onSave,
  onSubmit,
  onReview,
  onRequestChanges,
}: MixingStudyWorksheetProps) {
  const [testSelection, setTestSelection] = useState<MixingTestSelection>(study.testSelection);
  const [studyDate, setStudyDate] = useState(study.studyDate);
  const [aptt, setAptt] = useState(() => sectionFromResult(study.results.find((row) => row.testType === 'aptt')));
  const [pt, setPt] = useState(() => sectionFromResult(study.results.find((row) => row.testType === 'pt')));
  const [reviewComment, setReviewComment] = useState(study.reviewComment ?? '');
  const [errors, setErrors] = useState<MixingStudyFieldErrors>({});

  const draft = useMemo<MixingStudyDraftInput>(() => ({
    testSelection,
    studyDate,
    aptt,
    pt,
    reviewComment,
  }), [aptt, pt, reviewComment, studyDate, testSelection]);

  const editable = study.canEdit && !saving;
  const showAptt = testSelection === 'aptt' || testSelection === 'both';
  const showPt = testSelection === 'pt' || testSelection === 'both';

  const updateSection = (
    test: 'aptt' | 'pt',
    field: keyof MixingSectionInput,
    value: string,
  ) => {
    const setter = test === 'aptt' ? setAptt : setPt;
    setter((current) => ({ ...current, [field]: value }));
  };

  const save = () => {
    const nextErrors = validateMixingStudy(draft, 'draft');
    setErrors(nextErrors);
    if (mixingStudyHasErrors(nextErrors)) return;
    onSave(draft);
  };

  const submit = () => {
    const nextErrors = validateMixingStudy(draft, 'submit');
    setErrors(nextErrors);
    if (mixingStudyHasErrors(nextErrors)) return;
    onSubmit(draft);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {study.studyNumber}
            <Badge variant={study.status === 'reviewed' ? 'default' : 'secondary'}>
              {MIXING_STUDY_STATUS_LABELS[study.status]}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Date</span>
            <Input
              type="date"
              value={studyDate}
              disabled={!editable}
              onChange={(event) => setStudyDate(event.target.value)}
            />
          </label>
          <fieldset className="space-y-2 text-sm" disabled={!editable}>
            <legend className="font-medium">Test selection</legend>
            {([
              ['aptt', 'APTT only'],
              ['pt', 'PT only'],
              ['both', 'Both PT and APTT'],
            ] as const).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="testSelection"
                  value={value}
                  checked={testSelection === value}
                  onChange={() => setTestSelection(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          {errors.form && <p className="text-sm text-destructive sm:col-span-2" role="alert">{errors.form}</p>}
        </CardContent>
      </Card>

      {showAptt && (
        <SectionCard
          title="APTT mixing study"
          section={aptt}
          disabled={!editable}
          error={errors.aptt ?? (serverMessage?.includes('APTT') ? serverMessage : undefined)}
          onChange={(field, value) => updateSection('aptt', field, value)}
        />
      )}
      {showPt && (
        <SectionCard
          title="PT mixing study"
          section={pt}
          disabled={!editable}
          error={errors.pt ?? (serverMessage?.includes('PT:') || serverMessage?.startsWith('PT ') ? serverMessage : undefined)}
          onChange={(field, value) => updateSection('pt', field, value)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rosner threshold</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{ROSNER_THRESHOLD_STATEMENT}</p>
          <p className="text-muted-foreground">Rosner&apos;s index = {ROSNER_FORMULA}</p>
          <p>The index is decision support. The conclusion for each performed test is recorded separately.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 pt-6 text-sm">
          <p>{formatMixingStaffLine('Performed By', study.performedByName, study.performedByStaffId)}</p>
          <p>
            {study.reviewedByName
              ? formatMixingStaffLine('Reviewed By', study.reviewedByName, study.reviewedByStaffId)
              : 'Reviewed By:'}
          </p>
          {study.reviewComment && (
            <p><span className="font-medium">Review comment:</span> {study.reviewComment}</p>
          )}
        </CardContent>
      </Card>

      {study.events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workflow history</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {study.events.map((event, index) => (
                <li key={`${event.eventType}-${event.performedAt}-${index}`}>
                  {event.eventType.replaceAll('_', ' ')} · {event.actorName ?? 'Staff'}
                  {event.actorStaffId ? ` · Staff ID: ${event.actorStaffId}` : ''}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {study.canEdit && (
          <Button type="button" variant="outline" disabled={saving} onClick={save}>Save Draft</Button>
        )}
        {study.canSubmit && (
          <Button type="button" disabled={saving} onClick={submit}>Submit for Review</Button>
        )}
      </div>

      {study.canReview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Independent review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder="Review comment"
              disabled={saving}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" disabled={saving} onClick={() => onReview(reviewComment)}>Review</Button>
              <Button type="button" variant="outline" disabled={saving} onClick={() => onRequestChanges(reviewComment)}>
                Request Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {serverMessage && !serverMessage.includes('APTT') && !serverMessage.startsWith('PT') && (
        <p className="text-sm text-destructive" role="alert">{serverMessage}</p>
      )}
    </div>
  );
}

function SectionCard({
  title,
  section,
  disabled,
  error,
  onChange,
}: {
  title: string;
  section: MixingSectionInput;
  disabled: boolean;
  error?: string;
  onChange: (field: keyof MixingSectionInput, value: string) => void;
}) {
  const fields: Array<[keyof MixingSectionInput, string]> = [
    ['patientClottingTime', 'Patient sample (seconds)'],
    ['nppClottingTime', 'NPP (seconds)'],
    ['targetValue', 'Target value'],
    ['immediateMixClottingTime', 'Immediate 1:1 mix (seconds)'],
    ['incubatedMixClottingTime', 'After-incubation 1:1 mix (seconds)'],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {fields.map(([field, label]) => (
          <label key={field} className="space-y-1 text-sm">
            <span className="font-medium">{label}</span>
            <Input
              inputMode="decimal"
              autoComplete="off"
              value={section[field]}
              disabled={disabled}
              onChange={(event) => onChange(field, event.target.value)}
            />
          </label>
        ))}
        <p className="text-sm sm:col-span-2">
          <span className="font-medium">Rosner&apos;s Index before incubation: </span>
          {liveIndex(section.patientClottingTime, section.nppClottingTime, section.immediateMixClottingTime)}
        </p>
        <p className="text-sm sm:col-span-2">
          <span className="font-medium">Rosner&apos;s Index after incubation: </span>
          {liveIndex(section.patientClottingTime, section.nppClottingTime, section.incubatedMixClottingTime)}
        </p>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="font-medium">Conclusion</span>
          <Textarea
            value={section.conclusion}
            disabled={disabled}
            onChange={(event) => onChange('conclusion', event.target.value)}
          />
        </label>
        {error && <p className="text-sm text-destructive sm:col-span-2" role="alert">{error}</p>}
      </CardContent>
    </Card>
  );
}
