interface PrintReportingPeriodProps {
  label: string;
  className?: string;
}

export function PrintReportingPeriod({ label, className = '' }: PrintReportingPeriodProps) {
  return (
    <p className={`print-reporting-period text-sm text-foreground ${className}`.trim()}>
      Reporting Period: {label}
    </p>
  );
}
