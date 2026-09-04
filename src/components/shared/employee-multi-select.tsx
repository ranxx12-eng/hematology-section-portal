'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface EmployeeOption {
  id: string;
  fullName: string;
}

interface EmployeeMultiSelectProps {
  label?: string;
  employees: EmployeeOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  required?: boolean;
}

export function EmployeeMultiSelect({
  label = 'Assign to',
  employees,
  selectedIds,
  onChange,
  disabled = false,
  required = false,
}: EmployeeMultiSelectProps) {
  const [search, setSearch] = useState('');

  const nameById = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e.fullName])),
    [employees],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.fullName.toLowerCase().includes(q));
  }, [employees, search]);

  const toggle = (id: string) => {
    if (disabled) return;
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  };

  return (
    <div className="space-y-2">
      <Label>{label}{required ? ' *' : ''}</Label>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1 pe-1">
              {nameById[id] ?? id}
              {!disabled && (
                <button
                  type="button"
                  className="rounded-sm hover:bg-muted-foreground/20 p-0.5"
                  aria-label={`Remove ${nameById[id] ?? id}`}
                  onClick={() => toggle(id)}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
      <Input
        placeholder="Search employees…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={disabled}
      />
      <div className="max-h-44 overflow-y-auto rounded-lg border border-border p-3 space-y-2">
        {employees.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active employees found.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching employees.</p>
        ) : (
          filtered.map((employee) => (
            <label key={employee.id} className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={selectedIds.includes(employee.id)}
                onCheckedChange={() => toggle(employee.id)}
                disabled={disabled}
              />
              <span>{employee.fullName}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
