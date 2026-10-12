import {
  testsForSelection,
  type MixingTestSelection,
  type MixingTestType,
} from '@/lib/medical-reports/form-hema-023/constants';
import { calculateRosnerIndex } from '@/lib/medical-reports/form-hema-023/rosner';

export interface MixingSectionInput {
  patientClottingTime: string;
  nppClottingTime: string;
  targetValue: string;
  immediateMixClottingTime: string;
  incubatedMixClottingTime: string;
  conclusion: string;
}

export interface MixingStudyDraftInput {
  testSelection: MixingTestSelection;
  studyDate: string;
  aptt: MixingSectionInput;
  pt: MixingSectionInput;
  reviewComment?: string;
}

export interface MixingStudyFieldErrors {
  aptt?: string;
  pt?: string;
  form?: string;
}

const EMPTY_SECTION: MixingSectionInput = {
  patientClottingTime: '',
  nppClottingTime: '',
  targetValue: '',
  immediateMixClottingTime: '',
  incubatedMixClottingTime: '',
  conclusion: '',
};

export function emptyMixingSection(): MixingSectionInput {
  return { ...EMPTY_SECTION };
}

function sectionOf(input: MixingStudyDraftInput, testType: MixingTestType): MixingSectionInput {
  return testType === 'aptt' ? input.aptt : input.pt;
}

function labelFor(testType: MixingTestType): string {
  return testType === 'aptt' ? 'APTT' : 'PT';
}

function positiveDecimalMessage(raw: string, label: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^(\d+)(\.\d+)?$/.test(trimmed) || Number(trimmed) <= 0) {
    return `${label} must be a positive number`;
  }
  return null;
}

export function validateMixingSection(
  testType: MixingTestType,
  section: MixingSectionInput,
  mode: 'draft' | 'submit',
): string | null {
  const label = labelFor(testType);
  const timeFields: Array<[string, string]> = [
    ['Patient clotting time', section.patientClottingTime],
    ['NPP clotting time', section.nppClottingTime],
    ['Immediate 1:1 mix', section.immediateMixClottingTime],
    ['After-incubation 1:1 mix', section.incubatedMixClottingTime],
  ];
  for (const [name, value] of timeFields) {
    const message = positiveDecimalMessage(value, `${label} ${name}`);
    if (message) return message;
  }
  const targetMessage = positiveDecimalMessage(section.targetValue, `${label} target value`);
  if (targetMessage) return targetMessage;

  if (mode === 'draft') return null;

  const immediate = calculateRosnerIndex(
    section.patientClottingTime,
    section.nppClottingTime,
    section.immediateMixClottingTime,
  );
  const incubated = calculateRosnerIndex(
    section.patientClottingTime,
    section.nppClottingTime,
    section.incubatedMixClottingTime,
  );
  if (immediate.status === 'cannot_calculate' || incubated.status === 'cannot_calculate') {
    return `${label}: Cannot Calculate`;
  }
  if (immediate.status !== 'calculated' || incubated.status !== 'calculated') {
    return `${label}: Incomplete`;
  }
  if (!/^(\d+)(\.\d+)?$/.test(section.targetValue.trim()) || Number(section.targetValue) <= 0) {
    return `${label} target value must be a positive number`;
  }
  if (!section.conclusion.trim()) {
    return `${label}: Conclusion is required`;
  }
  return null;
}

export function validateMixingStudy(
  input: MixingStudyDraftInput,
  mode: 'draft' | 'submit',
): MixingStudyFieldErrors {
  const errors: MixingStudyFieldErrors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.studyDate)) {
    errors.form = 'Study date is invalid';
  }
  for (const testType of testsForSelection(input.testSelection)) {
    const message = validateMixingSection(testType, sectionOf(input, testType), mode);
    if (message) errors[testType] = message;
  }
  return errors;
}

export function mixingStudyHasErrors(errors: MixingStudyFieldErrors): boolean {
  return Boolean(errors.aptt || errors.pt || errors.form);
}

export function buildMixingStudyPayload(input: MixingStudyDraftInput) {
  const results = testsForSelection(input.testSelection).map((testType) => {
    const section = sectionOf(input, testType);
    return {
      testType,
      patientClottingTime: section.patientClottingTime.trim(),
      nppClottingTime: section.nppClottingTime.trim(),
      targetValue: section.targetValue.trim(),
      immediateMixClottingTime: section.immediateMixClottingTime.trim(),
      incubatedMixClottingTime: section.incubatedMixClottingTime.trim(),
      conclusion: section.conclusion.trim(),
    };
  });
  return {
    testSelection: input.testSelection,
    studyDate: input.studyDate,
    results,
  };
}
