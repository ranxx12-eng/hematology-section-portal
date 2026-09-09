import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QcCatalogGrid } from '@/components/qc-records/qc-catalog-grid';
import type { QcCatalogCardViewModel } from '@/lib/qc-records/qc-catalog';

const instrumentCard: QcCatalogCardViewModel = {
  id: 'instrument-alinity',
  name: 'CBC QC',
  subtitle: 'Alinity HQ 1147',
  instrumentName: 'Alinity HQ 1147',
  frequency: 'Daily',
  kind: 'instrument_qc_records',
  disabled: false,
  status: 'Completed',
};

const rapiCard: QcCatalogCardViewModel = {
  id: 'rapi-stain-qc',
  name: 'RAPI Stain QC',
  subtitle: 'Form-Hema-021 · Manual Test',
  instrumentName: 'Manual Test',
  parameter: 'RAPI Stain QC',
  formCode: 'Form-Hema-021',
  frequency: 'Daily',
  kind: 'rapi_stain',
  disabled: false,
  status: 'Due',
  sheetId: 'sheet-1',
  sheetMonth: 9,
  sheetYear: 2026,
};

describe('QcCatalogGrid', () => {
  it('does not render disabled placeholder history buttons', () => {
    render(
      <QcCatalogGrid
        cards={[instrumentCard]}
        locale="en"
        canManage
        canReview={false}
        onRecord={() => undefined}
      />,
    );
    expect(screen.queryByRole('button', { name: /view history/i })).toBeNull();
  });

  it('links RAPI View Monthly Form to the current sheet when available', () => {
    render(
      <QcCatalogGrid
        cards={[rapiCard]}
        locale="en"
        canManage
        canReview={false}
        onRecord={() => undefined}
      />,
    );
    const link = screen.getByRole('link', { name: /view monthly form/i });
    expect(link.getAttribute('href')).toBe('/en/quality-control/stain-qc/hema-021/sheet-1');
  });

  it('calls onViewHistory for instrument cards when provided', () => {
    const onViewHistory = vi.fn();
    render(
      <QcCatalogGrid
        cards={[instrumentCard]}
        locale="en"
        canManage
        canReview={false}
        onRecord={() => undefined}
        onViewHistory={onViewHistory}
      />,
    );
    screen.getByRole('button', { name: /view history/i }).click();
    expect(onViewHistory).toHaveBeenCalledWith(instrumentCard);
  });
});
