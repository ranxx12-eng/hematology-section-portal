import { describe, expect, it } from 'vitest';
import { parseLabelText } from './parse-label-text';

describe('parseLabelText', () => {
  it('extracts accession from barcode with high confidence', () => {
    const result = parseLabelText('', { barcodeAccession: 'C2601040291-1' });
    expect(result.labAccession).toBe('C2601040291-1');
    expect(result.confidence?.labAccession).toBeGreaterThanOrEqual(0.9);
    expect(result.sources?.labAccession).toBe('barcode');
  });

  it('parses patient name, id, and accession from OCR lines', () => {
    const text = [
      'ABDULRAHMAN MOHAMMED ALI',
      '03/02/2026 09:30 334931',
      'C2601040291-1',
    ].join('\n');

    const result = parseLabelText(text);

    expect(result.patientName).toBe('ABDULRAHMAN MOHAMMED ALI');
    expect(result.patientId).toBe('334931');
    expect(result.labAccession).toBe('C2601040291-1');
  });

  it('prefers barcode accession over OCR text', () => {
    const text = 'C2601040196-1\nOTHER LINE';
    const result = parseLabelText(text, { barcodeAccession: 'C2601040291-1' });
    expect(result.labAccession).toBe('C2601040291-1');
    expect(result.sources?.labAccession).toBe('barcode');
  });

  it('returns partial results when only some fields are detected', () => {
    const result = parseLabelText('C2601040196-1');
    expect(result.labAccession).toBe('C2601040196-1');
    expect(result.patientName).toBeUndefined();
    expect(result.patientId).toBeUndefined();
  });

  it('returns empty result for unreadable text', () => {
    const result = parseLabelText('!!! ???');
    expect(result.patientName).toBeUndefined();
    expect(result.patientId).toBeUndefined();
    expect(result.labAccession).toBeUndefined();
  });
});
