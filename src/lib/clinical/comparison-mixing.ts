import { createClient } from '@/lib/supabase/client';
import {
  calculateElapsedMinutes,
  calculateMixingResult,
  deriveMixingModeStatus,
  deriveMixingOverallResult,
  isTimingValid,
} from '@/lib/comparison-studies/mixing-calculation';
import {
  FORM_HEMA_018_TITLE,
  MIXING_MODES,
  MIXING_PARAMETERS,
  MIXING_SAMPLE_COUNT,
  suggestMixingConclusion,
} from '@/lib/comparison-studies/mixing-constants';
import type {
  ComparisonMixingResult,
  ComparisonMixingSample,
  ComparisonOverallResult,
  ComparisonStudy,
  MixingMode,
} from '@/types/comparison-study';

export interface MixingSampleInput {
  id: string;
  initialTestTime?: string | null;
  finalTestTime?: string | null;
}

export interface MixingResultInput {
  id: string;
  firstResult?: number | null;
  finalResult?: number | null;
}

export interface MixingStudySaveInput {
  samples: MixingSampleInput[];
  results: MixingResultInput[];
  conclusion?: string;
  studyDate?: string;
  referenceInstrumentId?: string;
  referenceLabel?: string;
}

export async function fetchMixingRelations(studyId: string): Promise<{
  mixingSamples: ComparisonMixingSample[];
  mixingResults: ComparisonMixingResult[];
}> {
  const supabase = createClient();
  const samplesRes = await supabase
    .from('comparison_mixing_samples')
    .select('*')
    .eq('study_id', studyId)
    .order('display_order');

  const sampleIds = (samplesRes.data ?? []).map((row) => row.id as string);
  let resultsData: Array<Record<string, unknown>> = [];
  if (sampleIds.length > 0) {
    const resultsRes = await supabase
      .from('comparison_mixing_results')
      .select('*')
      .in('mixing_sample_id', sampleIds)
      .order('display_order');
    resultsData = (resultsRes.data ?? []) as Array<Record<string, unknown>>;
  }

  const mixingSamples: ComparisonMixingSample[] = (samplesRes.data ?? []).map((row) => ({
    id: row.id as string,
    studyId: row.study_id as string,
    mode: row.mode as MixingMode,
    sampleNumber: row.sample_number as number,
    initialTestTime: (row.initial_test_time as string | null) ?? undefined,
    finalTestTime: (row.final_test_time as string | null) ?? undefined,
    elapsedMinutes: row.elapsed_minutes != null ? Number(row.elapsed_minutes) : undefined,
    timingValid: row.timing_valid != null ? Boolean(row.timing_valid) : undefined,
    displayOrder: row.display_order as number,
  }));

  const mixingResults: ComparisonMixingResult[] = resultsData.map((row) => ({
    id: row.id as string,
    mixingSampleId: row.mixing_sample_id as string,
    testCode: row.test_code as string,
    testName: row.test_name as string,
    unit: row.unit as string,
    taePercentSnapshot: Number(row.tae_percent_snapshot),
    firstResult: row.first_result != null ? Number(row.first_result) : undefined,
    taeValue: row.tae_value != null ? Number(row.tae_value) : undefined,
    lowerLimit: row.lower_limit != null ? Number(row.lower_limit) : undefined,
    upperLimit: row.upper_limit != null ? Number(row.upper_limit) : undefined,
    finalResult: row.final_result != null ? Number(row.final_result) : undefined,
    resultStatus: row.result_status as ComparisonMixingResult['resultStatus'],
    displayOrder: row.display_order as number,
  }));

  return { mixingSamples, mixingResults };
}

export async function seedMixingStructure(studyId: string): Promise<void> {
  const supabase = createClient();
  for (const mode of MIXING_MODES) {
    for (let sampleNumber = 1; sampleNumber <= MIXING_SAMPLE_COUNT; sampleNumber += 1) {
      const { data: sampleRow } = await supabase
        .from('comparison_mixing_samples')
        .insert({
          study_id: studyId,
          mode,
          sample_number: sampleNumber,
          display_order: sampleNumber - 1,
        })
        .select('*')
        .single();
      if (!sampleRow) continue;

      for (const param of MIXING_PARAMETERS) {
        await supabase.from('comparison_mixing_results').insert({
          mixing_sample_id: sampleRow.id,
          test_code: param.testCode,
          test_name: param.testName,
          unit: param.unit,
          tae_percent_snapshot: param.taePercent,
          display_order: param.displayOrder,
        });
      }
    }
  }
}

function modeResults(
  study: ComparisonStudy,
  mode: MixingMode,
): ComparisonMixingResult[] {
  const sampleIds = new Set(
    (study.mixingSamples ?? []).filter((s) => s.mode === mode).map((s) => s.id),
  );
  return (study.mixingResults ?? []).filter((r) => sampleIds.has(r.mixingSampleId));
}

function modeTimingComplete(study: ComparisonStudy, mode: MixingMode): boolean {
  const samples = (study.mixingSamples ?? []).filter((s) => s.mode === mode);
  if (samples.length !== MIXING_SAMPLE_COUNT) return false;
  return samples.every((s) => s.timingValid === true);
}

export function computeMixingOverall(study: ComparisonStudy): ComparisonOverallResult {
  const closeResults = modeResults(study, 'close');
  const openResults = modeResults(study, 'open');
  return deriveMixingOverallResult(
    closeResults,
    openResults,
    modeTimingComplete(study, 'close'),
    modeTimingComplete(study, 'open'),
  );
}

export function summarizeMixingStudy(study: ComparisonStudy) {
  const results = study.mixingResults ?? [];
  const acceptable = results.filter((r) => r.resultStatus === 'acceptable').length;
  const notAcceptable = results.filter((r) => r.resultStatus === 'not_acceptable').length;
  const manualReview = results.filter((r) => r.resultStatus === 'manual_review').length;
  const incomplete = results.filter((r) => r.resultStatus === 'incomplete').length;
  const totalTests = results.length;
  const completed = acceptable + notAcceptable + manualReview;
  const overall = computeMixingOverall(study);

  return {
    closeModeStatus: deriveMixingModeStatus(
      modeResults(study, 'close'),
      modeTimingComplete(study, 'close'),
    ),
    openModeStatus: deriveMixingModeStatus(
      modeResults(study, 'open'),
      modeTimingComplete(study, 'open'),
    ),
    acceptable,
    notAcceptable,
    manualReview,
    incomplete,
    totalTests,
    totalSamples: study.mixingSamples?.length ?? 0,
    completionPercent: totalTests > 0 ? (completed / totalTests) * 100 : 0,
    overallResult: overall,
    suggestedConclusion: suggestMixingConclusion(overall),
  };
}

export async function persistMixingStudyData(
  study: ComparisonStudy,
  input: MixingStudySaveInput,
): Promise<ComparisonStudy> {
  const supabase = createClient();
  const sampleMap = new Map((study.mixingSamples ?? []).map((s) => [s.id, s]));

  for (const sampleInput of input.samples) {
    const existing = sampleMap.get(sampleInput.id);
    if (!existing) continue;

    const initial = sampleInput.initialTestTime ?? null;
    const final = sampleInput.finalTestTime ?? null;
    const elapsed = initial && final ? calculateElapsedMinutes(initial, final) : null;
    const timingValid = isTimingValid(elapsed);

    await supabase
      .from('comparison_mixing_samples')
      .update({
        initial_test_time: initial,
        final_test_time: final,
        elapsed_minutes: elapsed,
        timing_valid: timingValid,
      })
      .eq('id', sampleInput.id);
  }

  const refreshedSamples = await fetchMixingRelations(study.id);
  const timingBySample = new Map(
    refreshedSamples.mixingSamples.map((s) => [s.id, s.timingValid === true]),
  );

  for (const resultInput of input.results) {
    const existing = (study.mixingResults ?? []).find((r) => r.id === resultInput.id);
    if (!existing) continue;
    const timingValid = timingBySample.get(existing.mixingSampleId) ?? false;
    const calc = calculateMixingResult({
      firstResult: resultInput.firstResult,
      finalResult: resultInput.finalResult,
      taePercent: existing.taePercentSnapshot,
      timingValid,
    });

    await supabase
      .from('comparison_mixing_results')
      .update({
        first_result: resultInput.firstResult ?? null,
        final_result: resultInput.finalResult ?? null,
        tae_value: calc.taeValue ?? null,
        lower_limit: calc.lowerLimit ?? null,
        upper_limit: calc.upperLimit ?? null,
        result_status: calc.resultStatus,
      })
      .eq('id', resultInput.id);
  }

  if (input.studyDate || input.referenceInstrumentId || input.referenceLabel || input.conclusion != null) {
    await supabase
      .from('comparison_studies')
      .update({
        study_date: input.studyDate ?? study.studyDate ?? null,
        reference_instrument_id: input.referenceInstrumentId ?? study.referenceInstrumentId ?? null,
        reference_label: input.referenceLabel ?? study.referenceLabel ?? null,
        general_comments: input.conclusion ?? study.generalComments ?? null,
      })
      .eq('id', study.id);
  }

  return study;
}

export function defaultMixingStudyTitle(): string {
  return FORM_HEMA_018_TITLE;
}
