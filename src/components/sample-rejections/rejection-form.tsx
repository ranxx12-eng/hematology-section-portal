'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PatientLabelScanner } from '@/components/patient-label-scanner';
import { CreatableDepartmentCombobox } from '@/components/clinical/creatable-department-combobox';
import { STAFF_ID_NOT_ASSIGNED } from '@/lib/staff/identity';
import { MultiSelectField } from '@/components/shared/multi-select-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { lookupPatientByAccession } from '@/lib/clinical/accession-lookup';
import {
  deriveRequiredTubesForTests,
  formatUnmappedTestsMessage,
  formatRequiredTubesSnapshot,
} from '@/lib/clinical/sample-test-tube-map';
import {
  REJECTED_TESTS,
  REJECTION_DEPARTMENTS,
  REJECTION_REASONS,
} from '@/lib/sample-rejections/constants';
import { isOtherReasonSelected, type SampleRejectionFormData } from '@/lib/sample-rejections/schema';

interface SampleRejectionFormProps {
  form: SampleRejectionFormData;
  staffName: string;
  staffId: string;
  recordCreatedDate: string;
  recordCreatedTime: string;
  departmentOptions?: readonly string[];
  readOnly?: boolean;
  onChange: (form: SampleRejectionFormData) => void;
}

function RejectionReasonChecklist({
  selected,
  onToggle,
  disabled,
}: {
  selected: string[];
  onToggle: (value: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(
    () => REJECTION_REASONS.filter((o) => o.toLowerCase().includes(search.toLowerCase())),
    [search],
  );

  return (
    <div className="space-y-2">
      <Label>Rejection Reason(s) *</Label>
      <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} disabled={disabled} />
      <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-3 space-y-2">
        {filtered.map((option) => (
          <label key={option} className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={selected.includes(option)}
              onCheckedChange={() => onToggle(option)}
              disabled={disabled}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function SampleRejectionFormFields({
  form,
  staffName,
  staffId,
  recordCreatedDate,
  recordCreatedTime,
  departmentOptions = REJECTION_DEPARTMENTS,
  readOnly = false,
  onChange,
}: SampleRejectionFormProps) {
  const [lookupLoading, setLookupLoading] = useState(false);

  const derivedTubes = deriveRequiredTubesForTests(form.rejectedTests);

  const mergedDepartments = useMemo(
    () => [...new Set([...departmentOptions, form.department].filter(Boolean))].sort(),
    [departmentOptions, form.department],
  );

  const toggleRejectionReason = (value: string) => {
    const nextValues = form.rejectionReasons.includes(value)
      ? form.rejectionReasons.filter((v) => v !== value)
      : [...form.rejectionReasons, value];
    onChange({ ...form, rejectionReasons: nextValues });
  };

  const handleAccessionLookup = async (accession: string) => {
    const trimmed = accession.trim();
    if (!trimmed) return;

    setLookupLoading(true);
    const result = await lookupPatientByAccession(trimmed);
    setLookupLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    if (result.data) {
      onChange({
        ...form,
        patientLabAccNumber: result.data.accession,
        patientId: result.data.patientId,
        patientName: result.data.patientName,
      });
      toast.success('Patient details loaded from prior record');
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-primary">Patient and Sample Information</h3>
          {!readOnly && (
            <PatientLabelScanner
              disabled={readOnly}
              fields={['patientName', 'patientId', 'labAccession']}
              currentValues={{
                patientName: form.patientName,
                patientId: form.patientId,
                labAccession: form.patientLabAccNumber,
              }}
              onApply={(result) => {
                onChange({
                  ...form,
                  ...(result.patientName ? { patientName: result.patientName } : {}),
                  ...(result.patientId ? { patientId: result.patientId } : {}),
                  ...(result.labAccession ? { patientLabAccNumber: result.labAccession } : {}),
                });
              }}
            />
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CreatableDepartmentCombobox
            id="sr-department"
            label="Department"
            value={form.department}
            options={mergedDepartments}
            required
            disabled={readOnly}
            onChange={(department) => onChange({ ...form, department })}
          />
          <div>
            <Label htmlFor="sr-lab-accession">Patient Lab ACC# *</Label>
            <Input
              id="sr-lab-accession"
              value={form.patientLabAccNumber}
              required
              disabled={readOnly}
              placeholder="Enter lab accession"
              autoComplete="off"
              onChange={(e) => onChange({ ...form, patientLabAccNumber: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  void handleAccessionLookup(e.currentTarget.value.trim());
                }
              }}
            />
          </div>
          {lookupLoading && (
            <p className="md:col-span-2 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Looking up accession…
            </p>
          )}
          <div><Label>Patient ID *</Label><Input value={form.patientId} onChange={(e) => onChange({ ...form, patientId: e.target.value })} disabled={readOnly} /></div>
          <div><Label>Patient Name *</Label><Input value={form.patientName} onChange={(e) => onChange({ ...form, patientName: e.target.value })} disabled={readOnly} /></div>
          <div><Label>Rejection Date *</Label><Input type="date" value={form.rejectionDate} onChange={(e) => onChange({ ...form, rejectionDate: e.target.value })} disabled={readOnly} /></div>
          <div><Label>Rejection Time *</Label><Input type="time" value={form.rejectionTime} onChange={(e) => onChange({ ...form, rejectionTime: e.target.value })} disabled={readOnly} /></div>
          <div className="md:col-span-2">
            <MultiSelectField
              id="sr-rejected-tests"
              label="Sample Test Rejected"
              options={REJECTED_TESTS}
              selected={form.rejectedTests}
              required
              disabled={readOnly}
              onChange={(rejectedTests) => {
                const tubes = deriveRequiredTubesForTests(rejectedTests);
                onChange({
                  ...form,
                  rejectedTests,
                  rejectedTube: tubes.tubeSnapshot,
                });
              }}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Required Tube(s)</Label>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm min-h-[2.5rem]">
              {form.rejectedTests.length === 0 && '—'}
              {form.rejectedTests.length > 0 && !derivedTubes.hasUnmapped && (
                derivedTubes.tubes.length > 0
                  ? derivedTubes.tubes.map((tube) => <div key={tube}>{tube}</div>)
                  : '—'
              )}
              {derivedTubes.hasUnmapped && (
                <p className="text-destructive">{formatUnmappedTestsMessage(derivedTubes.unmappedTests)}</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Automatically determined from selected test(s).</p>
            {readOnly && form.rejectedTube && (
              <p className="text-xs text-muted-foreground">Stored snapshot: {form.rejectedTube}</p>
            )}
          </div>
        </div>
      </section>

      <section>
        <RejectionReasonChecklist selected={form.rejectionReasons} onToggle={toggleRejectionReason} disabled={readOnly} />
        {isOtherReasonSelected(form.rejectionReasons) && (
          <div className="mt-3">
            <Label>Please Specify Other Rejection Reason *</Label>
            <Textarea value={form.otherRejectionReason ?? ''} onChange={(e) => onChange({ ...form, otherRejectionReason: e.target.value })} disabled={readOnly} rows={3} />
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-primary mb-3">Nurse Notification</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Informed Nurse Name *</Label><Input value={form.informedNurseName} onChange={(e) => onChange({ ...form, informedNurseName: e.target.value })} disabled={readOnly} /></div>
          <div><Label>Nurse ID *</Label><Input value={form.nurseId} onChange={(e) => onChange({ ...form, nurseId: e.target.value })} disabled={readOnly} /></div>
          <div><Label>Nurse Notification Date *</Label><Input type="date" value={form.nurseNotificationDate} onChange={(e) => onChange({ ...form, nurseNotificationDate: e.target.value })} disabled={readOnly} /></div>
          <div><Label>Nurse Notification Time *</Label><Input type="time" value={form.nurseNotificationTime} onChange={(e) => onChange({ ...form, nurseNotificationTime: e.target.value })} disabled={readOnly} /></div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-primary">Doctor Notification</h3>
          <div className="flex items-center gap-2">
            <Label htmlFor="doctor-required">Doctor Notification Required</Label>
            <Switch id="doctor-required" checked={form.doctorNotificationRequired} onCheckedChange={(checked) => onChange({ ...form, doctorNotificationRequired: checked })} disabled={readOnly} />
          </div>
        </div>
        {form.doctorNotificationRequired && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Doctor Name *</Label><Input value={form.doctorName ?? ''} onChange={(e) => onChange({ ...form, doctorName: e.target.value })} disabled={readOnly} /></div>
            <div><Label>Doctor ID *</Label><Input value={form.doctorId ?? ''} onChange={(e) => onChange({ ...form, doctorId: e.target.value })} disabled={readOnly} /></div>
            <div><Label>Doctor Notification Date *</Label><Input type="date" value={form.doctorNotificationDate ?? ''} onChange={(e) => onChange({ ...form, doctorNotificationDate: e.target.value })} disabled={readOnly} /></div>
            <div><Label>Doctor Notification Time *</Label><Input type="time" value={form.doctorNotificationTime ?? ''} onChange={(e) => onChange({ ...form, doctorNotificationTime: e.target.value })} disabled={readOnly} /></div>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-primary mb-3">Staff Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Staff Name</Label><Input value={staffName} readOnly disabled className="bg-muted" /></div>
          <div><Label>Staff ID</Label><Input value={staffId || STAFF_ID_NOT_ASSIGNED} readOnly disabled className="bg-muted" /></div>
          <div><Label>Record Created Date</Label><Input value={recordCreatedDate} readOnly disabled className="bg-muted" /></div>
          <div><Label>Record Created Time</Label><Input value={recordCreatedTime} readOnly disabled className="bg-muted" /></div>
        </div>
      </section>

      <section>
        <Label>Comments</Label>
        <Textarea value={form.comments ?? ''} onChange={(e) => onChange({ ...form, comments: e.target.value })} disabled={readOnly} rows={3} />
      </section>
    </div>
  );
}

export function rejectionToForm(rejection: import('@/types').SampleRejection): SampleRejectionFormData {
  return {
    patientId: rejection.patientId,
    patientName: rejection.patientName,
    patientLabAccNumber: rejection.patientLabAccNumber,
    department: rejection.department,
    rejectionDate: rejection.rejectionDate,
    rejectionTime: rejection.rejectionTime,
    rejectedTests: rejection.rejectedTests,
    rejectedTube: rejection.rejectedTube,
    rejectionReasons: rejection.rejectionReasons,
    otherRejectionReason: rejection.otherRejectionReason ?? '',
    informedNurseName: rejection.informedNurseName,
    nurseId: rejection.nurseId,
    nurseNotificationDate: rejection.nurseNotificationDate,
    nurseNotificationTime: rejection.nurseNotificationTime,
    doctorNotificationRequired: rejection.doctorNotificationRequired,
    doctorName: rejection.doctorName ?? '',
    doctorId: rejection.doctorId ?? '',
    doctorNotificationDate: rejection.doctorNotificationDate ?? '',
    doctorNotificationTime: rejection.doctorNotificationTime ?? '',
    comments: rejection.comments ?? '',
  };
}

export function useRejectionDepartmentOptions(records: Array<{ department: string }>) {
  return useMemo(() => {
    const fromRecords = records.map((record) => record.department);
    return [...new Set([...REJECTION_DEPARTMENTS, ...fromRecords])].sort();
  }, [records]);
}
