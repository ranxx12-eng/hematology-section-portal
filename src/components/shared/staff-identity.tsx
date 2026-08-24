import { formatStaffIdLabel } from '@/lib/staff/identity';

interface StaffIdentityProps {
  fullName: string;
  staffId?: string | null;
  className?: string;
}

export function StaffIdentity({ fullName, staffId, className }: StaffIdentityProps) {
  return (
    <div className={className}>
      <div className="font-medium">{fullName}</div>
      <div className="text-xs text-muted-foreground">{formatStaffIdLabel(staffId)}</div>
    </div>
  );
}

export function StaffIdentityInline({ fullName, staffId }: StaffIdentityProps) {
  const idLabel = formatStaffIdLabel(staffId).replace('Staff ID: ', '');
  return (
    <span>
      {fullName}
      <span className="text-muted-foreground"> — {idLabel}</span>
    </span>
  );
}
