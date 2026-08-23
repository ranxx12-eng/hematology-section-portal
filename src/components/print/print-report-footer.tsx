import {
  getPrintFormMetadata,
  type PrintFormKey,
} from '@/lib/print/form-metadata';

interface PrintReportFooterProps {
  formKey: PrintFormKey;
}

export function PrintReportFooter({ formKey }: PrintReportFooterProps) {
  const { formName, formNo } = getPrintFormMetadata(formKey);

  return (
    <footer className="hidden print:block mt-6">
      <hr className="mb-3 border-t border-foreground/30" />
      <div className="flex justify-between text-xs text-foreground">
        <span>Form Name: {formName}</span>
        <span>Form No.: {formNo}</span>
      </div>
    </footer>
  );
}
