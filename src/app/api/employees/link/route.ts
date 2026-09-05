import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logServerAudit, requirePermission } from '@/lib/auth/server';
import { hasSupabaseConfig } from '@/lib/security/env';

interface LinkRpcResult {
  success: boolean;
  code: string;
  message?: string;
}

export async function POST(request: Request) {
  try {
    if (!hasSupabaseConfig()) {
      return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
    }

    const actor = await requirePermission('employees.manage');
    const body = await request.json() as { employeeId?: string };
    const employeeId = body.employeeId?.trim();

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('link_employee_to_portal_account', {
      p_employee_id: employeeId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const payload = data as LinkRpcResult;
    if (!payload?.success) {
      const status = payload?.code === 'no_portal_account' ? 409 : 400;
      return NextResponse.json(
        {
          error: payload?.message ?? 'Unable to link portal account.',
          code: payload?.code,
        },
        { status },
      );
    }

    await logServerAudit({
      userId: actor.id,
      role: actor.role,
      module: 'employees',
      action: 'link_portal_account',
      recordId: employeeId,
      success: true,
      metadata: { code: payload.code },
    });

    return NextResponse.json({ success: true, code: payload.code });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unable to link portal account.' }, { status: 500 });
  }
}
