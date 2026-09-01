'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  fetchQCMaterialConfigs,
  MALARIA_MATERIAL_PARAMETERS,
  upsertQCMaterialConfig,
  type QCMaterialConfig,
} from '@/lib/clinical/qc-material-config';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import type { Profile } from '@/types';

interface MaterialDraft {
  lotNumber: string;
  expiryDate: string;
}
interface QCMaterialConfigPanelProps {
  canManage: boolean;
  user: Profile | null;
  onUpdated?: (configs: QCMaterialConfig[]) => void;
}

export function QCMaterialConfigPanel({ canManage, user, onUpdated }: QCMaterialConfigPanelProps) {
  const [loading, setLoading] = useState(true);
  const [savingParameter, setSavingParameter] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, MaterialDraft>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await fetchQCMaterialConfigs();
    const nextDrafts = Object.fromEntries(
      MALARIA_MATERIAL_PARAMETERS.map((parameter) => {
        const existing = result.data.find((config) => config.parameterName === parameter);
        return [parameter, {
          lotNumber: existing?.lotNumber ?? '',
          expiryDate: existing?.expiryDate ?? '',
        }];
      }),
    );
    setDrafts(nextDrafts);
    setLoading(false);
    if (result.error) toast.error(result.error);
    else onUpdated?.(result.data);
  }, [onUpdated]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async (parameterName: string) => {
    if (!user) return;
    setSavingParameter(parameterName);
    const staff = await resolveStaffContext(user);
    const draft = drafts[parameterName];
    const result = await upsertQCMaterialConfig(staff, {
      parameterName,
      lotNumber: draft?.lotNumber ?? '',
      expiryDate: draft?.expiryDate || undefined,
    });
    setSavingParameter(null);
    if (result.error) toast.error(result.error);
    else {
      toast.success('Material configuration saved');
      await reload();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Malaria QC Material Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Configure lot number and expiry for Form-Hema-011 and Form-Hema-012 monthly print headers.
        </p>
        {MALARIA_MATERIAL_PARAMETERS.map((parameter) => (
          <div key={parameter} className="rounded-lg border p-4 space-y-3">
            <p className="font-medium text-sm">{parameter}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`lot-${parameter}`}>Lot #</Label>
                <Input
                  id={`lot-${parameter}`}
                  value={drafts[parameter]?.lotNumber ?? ''}
                  disabled={!canManage}
                  onChange={(event) => setDrafts((prev) => ({
                    ...prev,
                    [parameter]: {
                      ...prev[parameter],
                      lotNumber: event.target.value,
                    },
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`expiry-${parameter}`}>Expiry Date</Label>
                <Input
                  id={`expiry-${parameter}`}
                  type="date"
                  value={drafts[parameter]?.expiryDate ?? ''}
                  disabled={!canManage}
                  onChange={(event) => setDrafts((prev) => ({
                    ...prev,
                    [parameter]: {
                      ...prev[parameter],
                      expiryDate: event.target.value,
                    },
                  }))}
                />
              </div>
            </div>
            {canManage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savingParameter === parameter}
                onClick={() => void save(parameter)}
              >
                {savingParameter === parameter ? 'Saving…' : 'Save Material Config'}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
