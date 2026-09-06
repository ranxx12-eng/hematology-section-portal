import {
  STAIN_QC_RESULT_SYMBOL_LEGEND,
  formatStainQcLegendLine,
  stainQcResultLegendText,
} from '@/lib/stain-qc/constants';

interface StainQcResultLegendProps {
  className?: string;
}

export function StainQcResultLegend({ className }: StainQcResultLegendProps) {
  const lines = stainQcResultLegendText();

  return (
    <div
      className={className}
      role="group"
      aria-label="Result symbol legend"
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        Coding / Legend
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
        {STAIN_QC_RESULT_SYMBOL_LEGEND.map((entry) => {
          const line = formatStainQcLegendLine(entry.symbol, entry.label);
          return (
            <li key={entry.label} aria-label={line}>
              {line}
            </li>
          );
        })}
      </ul>
      <p className="sr-only">{lines.join('. ')}</p>
    </div>
  );
}

export { stainQcResultLegendText };
