export type ClinicalListResult<T> = {
  data: T[];
  error: string | null;
};

export type ClinicalResult<T> = {
  data: T | null;
  error: string | null;
};

export function formatSupabaseError(context: string, error: { message: string }): string {
  return `${context}: ${error.message}`;
}

export async function runClinicalListQuery<T>(
  context: string,
  query: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<ClinicalListResult<T>> {
  try {
    const { data, error } = await query();
    if (error) return { data: [], error: formatSupabaseError(context, error) };
    return { data: data ?? [], error: null };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err.message : `${context}: unexpected error`,
    };
  }
}

export async function runClinicalMutation<T>(
  context: string,
  query: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<ClinicalResult<T>> {
  try {
    const { data, error } = await query();
    if (error) return { data: null, error: formatSupabaseError(context, error) };
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : `${context}: unexpected error`,
    };
  }
}
