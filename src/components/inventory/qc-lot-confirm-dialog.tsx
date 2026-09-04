'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchInventoryItems } from '@/lib/clinical/inventory';
import { lookupQcLotVerification } from '@/lib/clinical/qc-lot-verification';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import type { InventoryItem, Profile } from '@/types';
import type { QcLotVerificationLookupResult } from '@/types/qc-lot-verification';

interface QcLotConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expectedItem: InventoryItem;
  instrumentId?: string;
  instrumentName?: string;
  user: Profile;
  onContinue: () => void;
}

export function QcLotConfirmDialog({
  open,
  onOpenChange,
  expectedItem,
  instrumentId,
  instrumentName,
  user,
  onContinue,
}: QcLotConfirmDialogProps) {
  const locale = useLocale();
  const [step, setStep] = useState<'confirm' | 'select' | 'result'>('confirm');
  const [storeItems, setStoreItems] = useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [lookup, setLookup] = useState<QcLotVerificationLookupResult | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep('confirm');
    setSelectedItem(null);
    setLookup(null);
  };

  const checkVerification = async (item: InventoryItem) => {
    setLoading(true);
    const result = await lookupQcLotVerification({
      verificationType: 'cbc',
      qcMaterialName: item.itemName,
      lotNumber: item.lotNumber ?? '',
      instrumentId,
    });
    setLookup(result);
    setStep('result');
    setLoading(false);

    const staff = await resolveStaffContext(user);
    const { logInventoryAudit } = await import('@/lib/clinical/inventory-audit');
    await logInventoryAudit(staff, {
      entityType: 'qc_lot_verification',
      entityId: result.studyId ?? item.id,
      inventoryItemId: item.id,
      lotNumber: item.lotNumber,
      action: 'VERIFICATION_LOOKUP',
      metadata: { status: result.status },
    });
  };

  const handleSameLot = async (yes: boolean) => {
    if (yes) {
      await checkVerification(expectedItem);
      return;
    }
    setLoading(true);
    const res = await fetchInventoryItems();
    const sameMaterial = res.data.filter(
      (i) => i.itemName.trim().toLowerCase() === expectedItem.itemName.trim().toLowerCase()
        && i.category === expectedItem.category,
    );
    setStoreItems(sameMaterial);
    setStep('select');
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you using this QC lot?</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Expected: {expectedItem.itemName} · Lot {expectedItem.lotNumber ?? '—'}
          {instrumentName ? ` · ${instrumentName}` : ''}
        </p>

        {step === 'confirm' && (
          <div className="flex gap-2">
            <Button className="flex-1" disabled={loading} onClick={() => void handleSameLot(true)}>Yes</Button>
            <Button className="flex-1" variant="outline" disabled={loading} onClick={() => void handleSameLot(false)}>No</Button>
          </div>
        )}

        {loading && <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>}

        {step === 'select' && !loading && (
          <div className="space-y-3">
            <Label>Select the physical QC lot you are using</Label>
            <Select
              value={selectedItem?.id ?? ''}
              onValueChange={(id) => setSelectedItem(storeItems.find((i) => i.id === id) ?? null)}
            >
              <SelectTrigger><SelectValue placeholder="Choose lot from Store" /></SelectTrigger>
              <SelectContent>
                {storeItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    Lot {item.lotNumber ?? '—'} · Qty {item.quantity} {item.unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              disabled={!selectedItem}
              onClick={() => selectedItem && void checkVerification(selectedItem)}
            >
              Check Verification
            </Button>
          </div>
        )}

        {step === 'result' && lookup && !loading && (
          <div className="space-y-3">
            <p className="text-sm">{lookup.message}</p>
            {lookup.status === 'verified' && (
              <Button className="w-full" onClick={() => { onContinue(); onOpenChange(false); reset(); }}>
                Continue
              </Button>
            )}
            {lookup.status === 'in_progress' && lookup.studyId && (
              <Button className="w-full" asChild>
                <Link href={`/${locale}/inventory/qc-lot-verification/cbc/${lookup.studyId}`}>Continue Verification</Link>
              </Button>
            )}
            {lookup.status === 'not_verified' && (
              <Button className="w-full" asChild>
                <Link href={`/${locale}/inventory/qc-lot-verification?start=${selectedItem?.id ?? expectedItem.id}`}>
                  Start QC Lot Verification
                </Link>
              </Button>
            )}
            {lookup.status === 'rejected' && (
              <Button className="w-full" asChild>
                <Link href={`/${locale}/inventory/qc-lot-verification?start=${selectedItem?.id ?? expectedItem.id}`}>
                  Start New Verification
                </Link>
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
