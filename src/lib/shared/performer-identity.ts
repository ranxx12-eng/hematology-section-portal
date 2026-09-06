export function formatPerformerInitials(name: string, staffId?: string | null): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return staffId ? `${initials}/${staffId}` : initials;
}
