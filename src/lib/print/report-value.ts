const EMPTY = '—';

export function printValue(value: string | null | undefined): string {
  if (value == null) return EMPTY;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : EMPTY;
}

export function printList(values: string[] | null | undefined, separator = ', '): string {
  if (!values?.length) return EMPTY;
  const joined = values.map((v) => v.trim()).filter(Boolean).join(separator);
  return joined.length > 0 ? joined : EMPTY;
}

export function printDateTime(
  date: string | null | undefined,
  time: string | null | undefined,
): string {
  const datePart = printValue(date);
  const timePart = printValue(time);
  if (datePart === EMPTY && timePart === EMPTY) return EMPTY;
  if (datePart === EMPTY) return timePart;
  if (timePart === EMPTY) return datePart;
  return `${datePart} ${timePart}`;
}

export function printTimestamp(iso: string | null | undefined): string {
  if (!iso?.trim()) return EMPTY;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return EMPTY;
  return parsed.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const DISCARD_STATUS_LABELS: Record<string, string> = {
  not_due: 'Not Due',
  discard_due: 'Discard Due',
  discarded: 'Discarded',
};

export function printDiscardStatus(
  status: string | null | undefined,
  discardDueAt: string | null | undefined,
): string {
  const label = status ? (DISCARD_STATUS_LABELS[status] ?? status) : EMPTY;
  if (label === EMPTY) return EMPTY;
  if (status === 'discard_due' && discardDueAt?.trim()) {
    const due = printTimestamp(discardDueAt);
    return due === EMPTY ? label : `${label} (${due})`;
  }
  return label;
}
