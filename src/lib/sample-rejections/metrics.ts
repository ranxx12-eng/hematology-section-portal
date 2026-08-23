import type { SampleRejection } from '@/types';

/** Count rejections with discard due status — same predicate as Sample Rejections "Discard Due" card. */
export function countDiscardDue(rejections: SampleRejection[]): number {
  return rejections.filter((rejection) => rejection.discardStatus === 'discard_due').length;
}
