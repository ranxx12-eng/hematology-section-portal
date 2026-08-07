import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logServerAudit, requireSystemAdmin } from '@/lib/auth/server';
import { hasSupabaseConfig } from '@/lib/security/env';
import { mapSupabaseProfile } from '@/lib/auth/profile';

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  employee_id?: string | null;
  avatar_url?: string | null;
  language: 'en' | 'ar';
  is_active: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET() {
  try {
    if (!hasSupabaseConfig()) {
      return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
    }

    const admin = await requireSystemAdmin();
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, employee_id, avatar_url, language, is_active, deleted_at, created_at, updated_at')
      .order('email');

    if (error) {
      return NextResponse.json({ error: 'Unable to load users.' }, { status: 500 });
    }

    const rows = (data ?? []) as ProfileRow[];
    const users = rows.map((row) => {
      const profile = mapSupabaseProfile(row);
      return {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
        isActive: row.is_active === true && !row.deleted_at,
      };
    });

    await logServerAudit({
      userId: admin.id,
      role: admin.role,
      module: 'users',
      action: 'list',
      success: true,
      metadata: { count: users.length },
    });

    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unable to load users.' }, { status: 500 });
  }
}
