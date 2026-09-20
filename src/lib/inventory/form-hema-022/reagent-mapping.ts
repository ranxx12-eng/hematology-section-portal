import {
  FORM_HEMA_022_REAGENTS,
  type FormHema022ReagentDefinition,
  type FormHema022TestDefinition,
} from '@/lib/inventory/form-hema-022/constants';

function normalizeReagentName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface ResolvedFormHema022Reagent {
  definition: FormHema022ReagentDefinition;
  matchedName: string;
}

export function resolveFormHema022Reagent(reagentName: string): ResolvedFormHema022Reagent | null {
  const normalized = normalizeReagentName(reagentName);
  for (const definition of FORM_HEMA_022_REAGENTS) {
    const candidates = [definition.displayName, ...definition.aliases];
    for (const candidate of candidates) {
      if (normalizeReagentName(candidate) === normalized) {
        return { definition, matchedName: candidate };
      }
    }
  }
  return null;
}

export function isFormHema022ReagentConfigured(reagentName: string): boolean {
  return resolveFormHema022Reagent(reagentName) != null;
}

export function snapshotTestsForReagent(definition: FormHema022ReagentDefinition): FormHema022TestDefinition[] {
  return definition.tests.map((test) => ({ ...test }));
}

export function reagentRequiresManualCriteria(definition: FormHema022ReagentDefinition): boolean {
  return definition.tests.some((test) => !test.autoInterpretationEnabled);
}

export function buildAcceptanceCriterionText(test: FormHema022TestDefinition): string {
  if (!test.autoInterpretationEnabled || test.acceptanceLimitPercent == null) {
    return 'Acceptance criteria not configured';
  }
  return `≤ ${test.acceptanceLimitPercent}% difference · ${test.unit ?? 'units'}`;
}
