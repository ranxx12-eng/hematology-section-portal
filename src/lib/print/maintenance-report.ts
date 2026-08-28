import { jsPDF } from 'jspdf';
import { fetchInstruments } from '@/lib/clinical/instruments';
import {
  groupMaintenanceRecordsForControlledPrint,
} from '@/lib/print/qc-controlled-form-data';
import {
  loadControlledFormLogo,
  renderMaintenance008APdf,
} from '@/lib/print/qc-controlled-form-pdf';
import { PRINT_LANDSCAPE_PAGE } from '@/lib/print/landscape-layout';
import type { Instrument, MaintenanceRecord } from '@/types';

export async function createMaintenance008AReportPdf(
  records: MaintenanceRecord[],
  instrumentNames: Record<string, string>,
  instrumentsById?: Record<string, Instrument>,
): Promise<jsPDF | null> {
  let instruments = instrumentsById;
  if (!instruments) {
    const instrumentsResult = await fetchInstruments();
    instruments = Object.fromEntries(instrumentsResult.data.map((instrument) => [instrument.id, instrument]));
  }

  const { controlledGroups } = groupMaintenanceRecordsForControlledPrint(
    records,
    instrumentNames,
    instruments,
  );

  if (controlledGroups.length === 0) return null;

  const doc = new jsPDF(PRINT_LANDSCAPE_PAGE);
  const logo = await loadControlledFormLogo();

  for (let index = 0; index < controlledGroups.length; index += 1) {
    if (index > 0) doc.addPage();
    await renderMaintenance008APdf(doc, controlledGroups[index], logo);
  }

  return doc;
}
