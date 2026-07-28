'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  REJECTED_TESTS,
  REJECTED_TUBES,
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
  readOnly?: boolean;
  onChange: (form: SampleRejectionFormData) => void;
}

function SearchableSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: readonly string[];
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        placeholder={`Search ${placeholder.toLowerCase()}...`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={disabled}
      />
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger><SelectValue placeholder={`Select ${placeholder}`} /></SelectTrigger>
        <SelectContent>
          {filtered.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MultiSelectChecklist({
  title,
  options,
  selected,
  onToggle,
  disabled,
}: {
  title: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  return (
    <div className="space-y-2">
      <Label>{title} *</Label>
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
  readOnly = false,
  onChange,
}: SampleRejectionFormProps) {
  const toggleArrayValue = (key: 'rejectedTests' | 'rejectionReasons', value: string) => {
    const current = form[key];
    onChange({
      ...form,
      [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    });
  };

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-medical-blue mb-3">Patient and Sample Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Patient ID *</Label><Input value={form.patientId} onChange={(e) => onChange({ ...form, patientId: e.target.value })} disabled={readOnly} /></div>
          <div><Label>Patient Name *</Label><Input value={form.patientName} onChange={(e) => onChange({ ...form, patientName: e.target.value })} disabled={readOnly} /></div>
          <div><Label>Patient Lab ACC# *</Label><Input value={form.patientLabAccNumber} onChange={(e) => onChange({ ...form, patientLabAccNumber: e.target.value })} disabled={readOnly} /></div>
          <SearchableSelect label="Department *" value={form.department} options={REJECTION_DEPARTMENTS} placeholder="department" onChange={(v) => onChange({ ...form, department: v })} disabled={readOnly} />
          <div><Label>Rejection Date *</Label><Input type="date" value={form.rejectionDate} onChange={(e) => onChange({ ...form, rejectionDate: e.target.value })} disabled={readOnly} /></div>
          <div><Label>Rejection Time *</Label><Input type="time" value={form.rejectionTime} onChange={(e) => onChange({ ...form, rejectionTime: e.target.value })} disabled={readOnly} /></div>
          <div className="md:col-span-2">
            <MultiSelectChecklist title="Sample Test Rejected" options={REJECTED_TESTS} selected={form.rejectedTests} onToggle={(v) => toggleArrayValue('rejectedTests', v)} disabled={readOnly} />
          </div>
          <div className="md:col-span-2">
            <SearchableSelect label="Sample Tube Rejected *" value={form.rejectedTube} options={REJECTED_TUBES} placeholder="tube" onChange={(v) => onChange({ ...form, rejectedTube: v })} disabled={readOnly} />
          </div>
        </div>
      </section>

      <section>
        <MultiSelectChecklist title="Rejection Reason(s)" options={REJECTION_REASONS} selected={form.rejectionReasons} onToggle={(v) => toggleArrayValue('rejectionReasons', v)} disabled={readOnly} />
        {isOtherReasonSelected(form.rejectionReasons) && (
          <div className="mt-3">
            <Label>Please Specify Other Rejection Reason *</Label>
            <Textarea value={form.otherRejectionReason ?? ''} onChange={(e) => onChange({ ...form, otherRejectionReason: e.target.value })} disabled={readOnly} rows={3} />
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-medical-blue mb-3">Nurse Notification</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Informed Nurse Name *</Label><Input value={form.informedNurseName} onChange={(e) => onChange({ ...form, informedNurseName: e.target.value })} disabled={readOnly} /></div>
          <div><Label>Nurse ID *</Label><Input value={form.nurseId} onChange={(e) => onChange({ ...form, nurseId: e.target.value })} disabled={readOnly} /></div>
          <div><Label>Nurse Notification Date *</Label><Input type="date" value={form.nurseNotificationDate} onChange={(e) => onChange({ ...form, nurseNotificationDate: e.target.value })} disabled={readOnly} /></div>
          <div><Label>Nurse Notification Time *</Label><Input type="time" value={form.nurseNotificationTime} onChange={(e) => onChange({ ...form, nurseNotificationTime: e.target.value })} disabled={readOnly} /></div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-medical-blue">Doctor Notification</h3>
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
        <h3 className="text-sm font-semibold text-medical-blue mb-3">Staff Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Staff Name</Label><Input value={staffName} readOnly disabled className="bg-muted" /></div>
          <div><Label>Staff ID</Label><Input value={staffId} readOnly disabled className="bg-muted" /></div>
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
