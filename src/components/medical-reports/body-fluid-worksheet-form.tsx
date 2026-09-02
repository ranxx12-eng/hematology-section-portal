'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BodyFluidCountGrid, BodyFluidTechFinalSummary } from '@/components/medical-reports/body-fluid-count-grid';
import { StaffIdentity } from '@/components/shared/staff-identity';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { fetchPortalStaff } from '@/lib/clinical/staff-profiles';
import {
  AGREEMENT_NOTE,
  CLOTTED_NOTE,
  FORM_HEMA_010_TITLE,
  RBC_FORMULA_DIVISOR,
  SPECIMEN_TYPE_LABELS,
  WBC_FORMULA_DIVISOR,
  agreementDisplay,
  deriveBodyFluidCounts,
  formatCellsPerMm3,
  resolveDilutionFactor,
  side2IsActive,
} from '@/lib/medical-reports/body-fluid-logic';
import {
  bodyFluidWorksheetFormSchema,
  type BodyFluidWorksheetFormData,
  worksheetToFormData,
  appendSide2Counts,
  removeSide2Counts,
} from '@/lib/medical-reports/body-fluid-schema';
import type { BodyFluidWorksheet } from '@/types/body-fluid-worksheet';
import type { StaffIdentity as StaffIdentityType } from '@/lib/staff/identity';

interface BodyFluidWorksheetFormProps {
  worksheet: BodyFluidWorksheet;
  editable: boolean;
  saving?: boolean;
  onSave: (form: BodyFluidWorksheetFormData) => Promise<void>;
  onSubmit: (form: BodyFluidWorksheetFormData) => Promise<void>;
}

export function BodyFluidWorksheetForm({
  worksheet,
  editable,
  saving,
  onSave,
  onSubmit,
}: BodyFluidWorksheetFormProps) {
  const [form, setForm] = useState<BodyFluidWorksheetFormData>(() => worksheetToFormData(worksheet));
  const [staffOptions, setStaffOptions] = useState<StaffIdentityType[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  const derived = useMemo(
    () => deriveBodyFluidCounts({
      counts: form.counts.map((entry) => ({
        techNumber: entry.techNumber,
        sideNumber: entry.sideNumber,
        cellType: entry.cellType,
        squareNumber: entry.squareNumber,
        countValue: entry.countValue ?? undefined,
      })),
      secondTechEnabled: form.secondTechEnabled,
      dilutionUsed: form.dilutionUsed,
      dilutionFactor: form.dilutionFactor,
    }),
    [form.counts, form.secondTechEnabled, form.dilutionUsed, form.dilutionFactor],
  );

  const tech1Side2Active = side2IsActive(
    form.counts.map((entry) => ({
      techNumber: entry.techNumber,
      sideNumber: entry.sideNumber,
      cellType: entry.cellType,
      squareNumber: entry.squareNumber,
      countValue: entry.countValue ?? undefined,
    })),
    1,
  );
  const tech2Side2Active = side2IsActive(
    form.counts.map((entry) => ({
      techNumber: entry.techNumber,
      sideNumber: entry.sideNumber,
      cellType: entry.cellType,
      squareNumber: entry.squareNumber,
      countValue: entry.countValue ?? undefined,
    })),
    2,
  );

  const dilutionFactor = resolveDilutionFactor(form.dilutionUsed, form.dilutionFactor);
  const commentRequired = derived.hasDiscrepancy;

  const loadStaff = async () => {
    if (staffOptions.length > 0) return;
    setLoadingStaff(true);
    const result = await fetchPortalStaff();
    setStaffOptions(result.data.filter((staff) => staff.isActive));
    setLoadingStaff(false);
    if (result.error) toast.error(result.error);
  };

  const persist = async (submit = false) => {
    const parsed = bodyFluidWorksheetFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid form');
      return;
    }
    if (submit) await onSubmit(parsed.data);
    else await onSave(parsed.data);
  };

  const enableSecondTech = async () => {
    await loadStaff();
    setForm((prev) => ({ ...prev, secondTechEnabled: true }));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{FORM_HEMA_010_TITLE}</h2>
          <Badge variant={worksheet.status === 'submitted' ? 'default' : 'secondary'}>
            {worksheet.status === 'submitted' ? 'Submitted' : 'Draft'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">Form-Hema-010</p>
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="font-semibold">Specimen Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bf-patient">Patient / Label Reference</Label>
            <Input
              id="bf-patient"
              value={form.patientLabelReference ?? ''}
              disabled={!editable}
              onChange={(event) => setForm((prev) => ({ ...prev, patientLabelReference: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bf-time">Time Received</Label>
            <Input
              id="bf-time"
              type="datetime-local"
              value={form.timeReceived ?? ''}
              disabled={!editable}
              onChange={(event) => setForm((prev) => ({ ...prev, timeReceived: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Primary Tech</Label>
            <StaffIdentity
              fullName={worksheet.primaryTechName}
              staffId={worksheet.primaryTechStaffId}
            />
          </div>
          <div className="space-y-2">
            <Label>Specimen Type</Label>
            <Select
              value={form.specimenType ?? ''}
              disabled={!editable}
              onValueChange={(value) => setForm((prev) => ({
                ...prev,
                specimenType: value as BodyFluidWorksheetFormData['specimenType'],
              }))}
            >
              <SelectTrigger><SelectValue placeholder="Select specimen type" /></SelectTrigger>
              <SelectContent>
                {Object.entries(SPECIMEN_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.specimenType === 'other' && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bf-specimen-other">Other Specimen Type</Label>
              <Input
                id="bf-specimen-other"
                value={form.specimenTypeOther ?? ''}
                disabled={!editable}
                onChange={(event) => setForm((prev) => ({ ...prev, specimenTypeOther: event.target.value }))}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="bf-tube">Hematology Tube #</Label>
            <Input
              id="bf-tube"
              value={form.tubeNumber ?? ''}
              disabled={!editable}
              onChange={(event) => setForm((prev) => ({ ...prev, tubeNumber: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Specimen Received</Label>
            <Select
              value={form.clotStatus ?? ''}
              disabled={!editable}
              onValueChange={(value) => setForm((prev) => ({
                ...prev,
                clotStatus: value as BodyFluidWorksheetFormData['clotStatus'],
              }))}
            >
              <SelectTrigger><SelectValue placeholder="Clotted / Not Clotted" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clotted">Clotted</SelectItem>
                <SelectItem value="not_clotted">Not Clotted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bf-color">Color &amp; Appearance</Label>
            <Input
              id="bf-color"
              value={form.colorAppearance ?? ''}
              disabled={!editable}
              onChange={(event) => setForm((prev) => ({ ...prev, colorAppearance: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bf-background">Counting Chamber Background</Label>
            <Input
              id="bf-background"
              value={form.chamberBackground ?? ''}
              disabled={!editable}
              onChange={(event) => setForm((prev) => ({ ...prev, chamberBackground: event.target.value }))}
            />
          </div>
        </div>
        <div className="rounded-md border bg-muted/30 p-3 text-sm">{CLOTTED_NOTE}</div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold">TECH #1</h3>
        <BodyFluidCountGrid
          techNumber={1}
          sideNumber={1}
          sideLabel="Side 1"
          techName={worksheet.primaryTechName}
          techStaffId={worksheet.primaryTechStaffId}
          counts={form.counts}
          derived={derived}
          editable={editable}
          onChange={(counts) => setForm((prev) => ({ ...prev, counts }))}
        />
        {tech1Side2Active ? (
          <div className="space-y-2">
            <BodyFluidCountGrid
              techNumber={1}
              sideNumber={2}
              sideLabel="Optional Second Side"
              counts={form.counts}
              derived={derived}
              editable={editable}
              onChange={(counts) => setForm((prev) => ({ ...prev, counts }))}
            />
            {editable && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setForm((prev) => ({ ...prev, counts: removeSide2Counts(prev.counts, 1) }))}
              >
                Remove Side 2
              </Button>
            )}
          </div>
        ) : editable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setForm((prev) => ({ ...prev, counts: appendSide2Counts(prev.counts, 1) }))}
          >
            + Add Side 2
          </Button>
        )}
        <BodyFluidTechFinalSummary techNumber={1} derived={derived} />
      </div>

      {form.secondTechEnabled ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1 space-y-2">
              <Label>Second Technologist</Label>
              <Select
                value={form.secondTechUserId ?? ''}
                disabled={!editable}
                onValueChange={(value) => setForm((prev) => ({ ...prev, secondTechUserId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingStaff ? 'Loading staff…' : 'Select second tech'} />
                </SelectTrigger>
                <SelectContent>
                  {staffOptions
                    .filter((staff) => staff.profileId !== worksheet.primaryTechUserId)
                    .map((staff) => (
                      <SelectItem key={staff.profileId} value={staff.profileId}>
                        {staff.fullName} — {staff.staffId ?? 'No Staff ID'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {editable && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setForm((prev) => ({
                  ...prev,
                  secondTechEnabled: false,
                  secondTechUserId: undefined,
                  counts: removeSide2Counts(prev.counts, 2),
                }))}
              >
                Remove Second Technologist
              </Button>
            )}
          </div>
          <h3 className="font-semibold">TECH #2</h3>
          <BodyFluidCountGrid
            techNumber={2}
            sideNumber={1}
            sideLabel="Side 1"
            techName={worksheet.secondTechName}
            techStaffId={worksheet.secondTechStaffId}
            counts={form.counts}
            derived={derived}
            editable={editable}
            onChange={(counts) => setForm((prev) => ({ ...prev, counts }))}
          />
          {tech2Side2Active ? (
            <div className="space-y-2">
              <BodyFluidCountGrid
                techNumber={2}
                sideNumber={2}
                sideLabel="Optional Second Side"
                counts={form.counts}
                derived={derived}
                editable={editable}
                onChange={(counts) => setForm((prev) => ({ ...prev, counts }))}
              />
              {editable && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm((prev) => ({ ...prev, counts: removeSide2Counts(prev.counts, 2) }))}
                >
                  Remove Side 2
                </Button>
              )}
            </div>
          ) : editable && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setForm((prev) => ({ ...prev, counts: appendSide2Counts(prev.counts, 2) }))}
            >
              + Add Side 2
            </Button>
          )}
          <BodyFluidTechFinalSummary techNumber={2} derived={derived} />
          <div className="rounded-lg border p-4 space-y-2 text-sm">
            <p><span className="font-medium">WBC Agreement:</span> {agreementDisplay(derived.wbcAgreement)}</p>
            <p><span className="font-medium">RBC Agreement:</span> {agreementDisplay(derived.rbcAgreement)}</p>
            <p className="text-muted-foreground">{AGREEMENT_NOTE}</p>
            {derived.hasDiscrepancy && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                Agreement Review Required — count discrepancy exceeds 30%. Document corrective action in Comments before final submission.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Second Technologist: Not Used</p>
          {editable && (
            <Button type="button" variant="outline" className="mt-3" onClick={() => void enableSecondTech()}>
              Add Second Technologist
            </Button>
          )}
        </div>
      )}

      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="font-semibold">Differential (Optional)</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="bf-neut">Neutrophils</Label>
            <Input
              id="bf-neut"
              type="number"
              min={0}
              value={form.differentialNeutrophils ?? ''}
              disabled={!editable}
              onChange={(event) => setForm((prev) => ({
                ...prev,
                differentialNeutrophils: event.target.value === '' ? undefined : Number(event.target.value),
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bf-lymph">Lymphocytes</Label>
            <Input
              id="bf-lymph"
              type="number"
              min={0}
              value={form.differentialLymphocytes ?? ''}
              disabled={!editable}
              onChange={(event) => setForm((prev) => ({
                ...prev,
                differentialLymphocytes: event.target.value === '' ? undefined : Number(event.target.value),
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bf-mono">Monocytes</Label>
            <Input
              id="bf-mono"
              type="number"
              min={0}
              value={form.differentialMonocytes ?? ''}
              disabled={!editable}
              onChange={(event) => setForm((prev) => ({
                ...prev,
                differentialMonocytes: event.target.value === '' ? undefined : Number(event.target.value),
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bf-other-type">Other Cells — Type</Label>
            <Input
              id="bf-other-type"
              value={form.differentialOtherType ?? ''}
              disabled={!editable}
              onChange={(event) => setForm((prev) => ({ ...prev, differentialOtherType: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bf-other-qty">Other Cells — Quantity</Label>
            <Input
              id="bf-other-qty"
              type="number"
              min={0}
              value={form.differentialOtherQuantity ?? ''}
              disabled={!editable}
              onChange={(event) => setForm((prev) => ({
                ...prev,
                differentialOtherQuantity: event.target.value === '' ? undefined : Number(event.target.value),
              }))}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="font-semibold">Dilution</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Dilution Used</Label>
            <Select
              value={form.dilutionUsed ? 'yes' : 'no'}
              disabled={!editable}
              onValueChange={(value) => setForm((prev) => ({
                ...prev,
                dilutionUsed: value === 'yes',
                dilutionFactor: value === 'yes' ? prev.dilutionFactor : undefined,
                dilutionBackgroundOk: value === 'yes' ? prev.dilutionBackgroundOk : undefined,
              }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.dilutionUsed && (
            <>
              <div className="space-y-2">
                <Label>Background Check OK</Label>
                <Select
                  value={form.dilutionBackgroundOk === true ? 'yes' : form.dilutionBackgroundOk === false ? 'no' : ''}
                  disabled={!editable}
                  onValueChange={(value) => setForm((prev) => ({
                    ...prev,
                    dilutionBackgroundOk: value === 'yes',
                  }))}
                >
                  <SelectTrigger><SelectValue placeholder="Yes / No" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bf-dilution-factor">Dilution Factor</Label>
                <Input
                  id="bf-dilution-factor"
                  type="number"
                  min={0}
                  step="any"
                  value={form.dilutionFactor ?? ''}
                  disabled={!editable}
                  onChange={(event) => setForm((prev) => ({
                    ...prev,
                    dilutionFactor: event.target.value === '' ? undefined : Number(event.target.value),
                  }))}
                />
              </div>
            </>
          )}
        </div>
        <div className="rounded-md bg-muted/40 p-3 text-sm space-y-1">
          <p>WBC: (Average × {dilutionFactor}) / {WBC_FORMULA_DIVISOR} = {formatCellsPerMm3(derived.finalWbc)}</p>
          <p>RBC: (Average × {dilutionFactor}) / {RBC_FORMULA_DIVISOR} = {formatCellsPerMm3(derived.finalRbc)}</p>
          {derived.hasDiscrepancy && (
            <p className="text-destructive">Final counts are withheld until discrepancy is documented.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <Label htmlFor="bf-comments">
          Comments{commentRequired ? ' (required — count discrepancy >30%)' : ' (optional)'}
        </Label>
        <Textarea
          id="bf-comments"
          rows={3}
          value={form.comments ?? ''}
          disabled={!editable}
          onChange={(event) => setForm((prev) => ({ ...prev, comments: event.target.value }))}
        />
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="font-semibold">Pathologist Review (If Applicable)</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bf-path-name">Reviewed By / Pathologist</Label>
            <Input
              id="bf-path-name"
              value={form.pathologistName ?? ''}
              disabled={!editable}
              onChange={(event) => setForm((prev) => ({ ...prev, pathologistName: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bf-path-staff">Staff ID</Label>
            <Input
              id="bf-path-staff"
              value={form.pathologistStaffId ?? ''}
              disabled={!editable}
              onChange={(event) => setForm((prev) => ({ ...prev, pathologistStaffId: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bf-path-date">Review Date/Time</Label>
            <Input
              id="bf-path-date"
              type="datetime-local"
              value={form.pathologistReviewedAt ?? ''}
              disabled={!editable}
              onChange={(event) => setForm((prev) => ({ ...prev, pathologistReviewedAt: event.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="bf-path-comment">Pathologist Comment</Label>
            <Textarea
              id="bf-path-comment"
              rows={2}
              value={form.pathologistComment ?? ''}
              disabled={!editable}
              onChange={(event) => setForm((prev) => ({ ...prev, pathologistComment: event.target.value }))}
            />
          </div>
        </div>
      </div>

      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={saving} onClick={() => void persist(false)}>
            {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
            Save Draft
          </Button>
          <Button type="button" variant="secondary" disabled={saving} onClick={() => void persist(true)}>
            Submit Worksheet
          </Button>
        </div>
      )}
    </div>
  );
}
