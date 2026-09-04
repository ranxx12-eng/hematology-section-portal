'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchInventoryAuditForItem, fetchInventoryAuditForLot } from '@/lib/clinical/inventory-audit';
import { formatDate } from '@/lib/utils';
import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';
import type { InventoryAuditEvent } from '@/types/inventory-module';

interface LotHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId?: string;
  lotNumber?: string;
  title?: string;
}

export function LotHistoryDrawer({ open, onOpenChange, itemId, lotNumber, title }: LotHistoryDrawerProps) {
  const locale = useLocale();
  const [events, setEvents] = useState<InventoryAuditEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const load = async () => {
      if (itemId) {
        const res = await fetchInventoryAuditForItem(itemId);
        setEvents(res.data);
      } else if (lotNumber) {
        const res = await fetchInventoryAuditForLot(lotNumber);
        setEvents(res.data);
      }
      setLoading(false);
    };
    void load();
  }, [open, itemId, lotNumber]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? 'Lot History'}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading history…</p>}
          {!loading && events.length === 0 && (
            <p className="text-sm text-muted-foreground">No history recorded yet.</p>
          )}
          {events.map((event) => (
            <div key={event.id} className="rounded-xl border p-3 text-sm">
              <p className="font-medium">{event.action.replace(/_/g, ' ')}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate(event.createdAt, locale)}
                {event.userName ? ` · ${event.userName}` : ''}
              </p>
              {event.lotNumber && <p className="text-xs mt-1">Lot: {event.lotNumber}</p>}
              {event.comment && <p className="text-xs mt-1">{event.comment}</p>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
