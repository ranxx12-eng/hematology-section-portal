export const PRINT_HOSPITAL_NAME = 'Al Sahafa Hospital';
export const PRINT_SECTION_NAME = 'Hematology Section';

export type PrintFormKey = 'criticalValues' | 'sampleRejections';

export interface PrintFormMetadata {
  formName: string;
  formNo: string;
}

export const PRINT_FORM_METADATA: Record<PrintFormKey, PrintFormMetadata> = {
  criticalValues: {
    formName: 'Critical Value Report',
    formNo: '1',
  },
  sampleRejections: {
    formName: 'Sample Rejection Report',
    formNo: '1',
  },
};

export function getPrintFormMetadata(formKey: PrintFormKey): PrintFormMetadata {
  return PRINT_FORM_METADATA[formKey];
}
