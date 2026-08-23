import {
  PRINT_HOSPITAL_NAME,
  PRINT_LOGO_SRC,
  PRINT_SECTION_NAME,
} from '@/lib/print/form-metadata';

export function PrintReportHeader() {
  return (
    <header className="print-report-header hidden print:block mb-4">
      <div className="flex flex-col items-center text-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PRINT_LOGO_SRC}
          alt="Hospital Logo"
          className="h-14 w-auto max-w-[120px] object-contain"
        />
        <p className="text-base font-semibold text-foreground">{PRINT_HOSPITAL_NAME}</p>
        <p className="text-sm text-foreground">{PRINT_SECTION_NAME}</p>
      </div>
      <hr className="mt-3 border-t border-foreground/30" />
    </header>
  );
}
