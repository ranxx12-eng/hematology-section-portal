import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { InventoryModuleSummary } from '@/types/inventory-module';

export function InventorySummaryCards({ summary }: { summary: InventoryModuleSummary }) {
  const cards = [
    { label: 'Total Stock Items', value: summary.totalItems },
    { label: 'Low Stock', value: summary.lowStock },
    { label: 'Expiring Soon', value: summary.expiringSoon },
    { label: 'Active Lots', value: summary.activeLots },
    { label: 'Pending Reagent Studies', value: summary.pendingReagentStudies },
    { label: 'Pending QC Verifications', value: summary.pendingQcStudies },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.label} className="rounded-2xl">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">{card.label}</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <p className="text-2xl font-semibold">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
