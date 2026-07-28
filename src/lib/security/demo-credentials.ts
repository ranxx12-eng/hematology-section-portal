/**
 * Demo-only credentials. Only used when NEXT_PUBLIC_DEMO_MODE=true.
 * Password is read from NEXT_PUBLIC_DEMO_PASSWORD (see .env.example).
 */
import type { Role } from '@/lib/permissions/roles';
import { getDemoPassword } from '@/lib/security/env';

export interface DemoUser {
  email: string;
  role: Role;
  name: string;
}

export const DEMO_USER_ACCOUNTS: DemoUser[] = [
  { email: 'admin@hematology.local', role: 'system_admin', name: 'System Admin' },
  { email: 'director@hematology.local', role: 'lab_director', name: 'Lab Director' },
  { email: 'manager@hematology.local', role: 'lab_manager', name: 'Lab Manager' },
  { email: 'head@hematology.local', role: 'head_of_section', name: 'Head of Section' },
  { email: 'supervisor@hematology.local', role: 'section_supervisor', name: 'Section Supervisor' },
  { email: 'quality@hematology.local', role: 'quality_officer', name: 'Quality Officer' },
  { email: 'education@hematology.local', role: 'education_coordinator', name: 'Education Coordinator' },
  { email: 'inventory@hematology.local', role: 'inventory_officer', name: 'Inventory Officer' },
  { email: 'leader@hematology.local', role: 'team_leader', name: 'Team Leader' },
  { email: 'senior@hematology.local', role: 'senior_lab_technologist', name: 'Senior Technologist' },
  { email: 'tech@hematology.local', role: 'lab_technologist', name: 'Lab Technologist' },
  { email: 'trainee@hematology.local', role: 'trainee', name: 'Trainee' },
  { email: 'readonly@hematology.local', role: 'read_only', name: 'Read Only' },
];

export function verifyDemoCredentials(email: string, password: string): DemoUser | null {
  const account = DEMO_USER_ACCOUNTS.find((u) => u.email === email);
  if (!account) return null;
  if (password !== getDemoPassword()) return null;
  return account;
}
