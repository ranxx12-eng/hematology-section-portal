/**
 * Portal-wide controlled form print standard.
 *
 * Operational UI labels stay generic; form code / QID / footer belong inside the
 * generated document (native renderer or uploaded blank template).
 */

/** User-facing print action — never include form codes in this label. */
export const CONTROLLED_FORM_PRINT_LABEL = 'Print';

export const CONTROLLED_FORM_EXPORT_PDF_LABEL = 'Export PDF';

export const CONTROLLED_FORM_EXPORT_EXCEL_LABEL = 'Export Excel';

export type ControlledTemplateType = 'native' | 'uploaded_blank';

export type ControlledTemplateStatus = 'draft' | 'published' | 'retired';

/** Metadata for a controlled hospital form template (native or uploaded). */
export interface ControlledFormTemplateMetadata {
  templateId?: string;
  formCode: string;
  formName: string;
  qid?: string;
  department?: string;
  section?: string;
  revision?: string;
  version?: number | string;
  effectiveDate?: string;
  templateFile?: string;
  templateType?: ControlledTemplateType;
  pageSize?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  isActive?: boolean;
  status?: ControlledTemplateStatus;
}

export interface ControlledFormFieldMapping {
  fieldKey: string;
  sourcePath: string;
  label?: string;
}

export interface ControlledFormRenderContext<TData = unknown> {
  data: TData;
  template: ControlledFormTemplateMetadata;
  /** Snapshot reference so historical records reprint against the approved template version. */
  templateVersionId?: string;
  fieldMappings?: ControlledFormFieldMapping[];
}

/** Common contract for native PDF renderers and future uploaded blank templates. */
export interface ControlledFormRenderer<TData = unknown> {
  getTemplate(): ControlledFormTemplateMetadata;
  render(context: ControlledFormRenderContext<TData>): Promise<Uint8Array | Blob>;
}

export interface ControlledFormPrintOptions {
  filename?: string;
  auditLog?: () => void | Promise<void>;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Render a controlled form and download it (gradual migration entry point). */
export async function printControlledForm<TData>(
  renderer: ControlledFormRenderer<TData>,
  context: ControlledFormRenderContext<TData>,
  options: ControlledFormPrintOptions = {},
): Promise<void> {
  const output = await renderer.render(context);
  const blob = output instanceof Blob
    ? output
    : new Blob([output.buffer as ArrayBuffer], { type: 'application/pdf' });
  const filename = options.filename
    ?? `${context.template.formCode.replace(/\s+/g, '-')}.pdf`;
  triggerBrowserDownload(blob, filename);
  if (options.auditLog) await options.auditLog();
}

export function getControlledFormTemplate(
  metadata: ControlledFormTemplateMetadata,
): ControlledFormTemplateMetadata {
  return metadata;
}
