'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  formatPortalAccountLabel,
  hasUnlinkedAssigneeSelection,
  PORTAL_LINK_STATUS_UNAVAILABLE_WARNING,
  UNLINKED_ASSIGNEE_WARNING,
  unknownPortalLinkStatus,
  type PortalAccountLinkState,
} from '@/lib/employees/portal-link';

export interface EmployeeOption {
  id: string;
  fullName: string;
  employeeCode?: string;
  portalLinkState?: PortalAccountLinkState;
  portalLoginActive?: boolean;
}

export interface EmployeeMultiSelectProps {
  label?: string;
  employees: EmployeeOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  required?: boolean;
  loading?: boolean;
  error?: string | null;
  portalLinkError?: string | null;
}

interface EmployeeMultiSelectComponentProps extends EmployeeMultiSelectProps {}

function portalLabelForEmployee(employee: EmployeeOption): string {
  const status = employee.portalLinkState
    ? {
        linkState: employee.portalLinkState,
        portalLinked: employee.portalLinkState === 'linked',
        portalLoginActive: employee.portalLoginActive ?? false,
        canLinkByStaffId: false,
      }
    : unknownPortalLinkStatus();
  return formatPortalAccountLabel(status);
}

export function EmployeeMultiSelect({
  label = 'Assign to',
  employees,
  selectedIds,
  onChange,
  disabled = false,
  required = false,
  loading = false,
  error = null,
  portalLinkError = null,
}: EmployeeMultiSelectComponentProps) {
  const [search, setSearch] = useState('');

  const nameById = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e.fullName])),
    [employees],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      e.fullName.toLowerCase().includes(q)
      || (e.employeeCode?.toLowerCase().includes(q) ?? false),
    );
  }, [employees, search]);

  const showUnlinkedWarning = !portalLinkError && hasUnlinkedAssigneeSelection(
    selectedIds,
    employees.map((employee) => ({
      id: employee.id,
      linkState: employee.portalLinkState ?? 'unknown',
    })),
  );

  const toggle = (id: string) => {
    if (disabled || loading) return;
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  };

  return (
    <div className="space-y-2">
      <Label>{label}{required ? ' *' : ''}</Label>
      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}
      {portalLinkError && (
        <p className="text-sm text-destructive" role="alert">{portalLinkError}</p>
      )}
      {showUnlinkedWarning && (
        <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
          {UNLINKED_ASSIGNEE_WARNING}
        </p>
      )}
      {!portalLinkError && employees.some((employee) => employee.portalLinkState === 'unknown') && (
        <p className="text-sm text-muted-foreground" role="status">
          {PORTAL_LINK_STATUS_UNAVAILABLE_WARNING}
        </p>
      )}
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
        disabled={disabled || loading}
      />
      <div className="max-h-44 overflow-y-auto rounded-lg border border-border p-3 space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading employees…</p>
        ) : error ? (
          <p className="text-sm text-muted-foreground">Unable to load employees.</p>
        ) : employees.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active employees found.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching employees.</p>
        ) : (
          filtered.map((employee) => (
            <label key={employee.id} className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={selectedIds.includes(employee.id)}
                onCheckedChange={() => toggle(employee.id)}
                disabled={disabled || loading}
              />
              <span className="space-y-0.5">
                <span className="block">{employee.fullName}</span>
                <span className="block text-xs text-muted-foreground">
                  {employee.employeeCode ? `Staff ID: ${employee.employeeCode}` : 'Staff ID: Not assigned'}
                  {' · '}
                  Portal: {portalLabelForEmployee(employee)}
                  {employee.portalLinkState === 'linked'
                    ? ` · Login: ${employee.portalLoginActive ? 'Active' : 'Inactive'}`
                    : ''}
                </span>
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
