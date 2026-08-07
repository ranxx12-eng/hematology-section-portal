import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { logServerAudit, requireSystemAdmin } from '@/lib/auth/server';
import { hasSupabaseConfig } from '@/lib/security/env';

const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export async function POST(request: Request) {
  let adminId: string | undefined;
  let adminRole: string | undefined;
  let targetUserId: string | undefined;

  try {
    if (!hasSupabaseConfig()) {
      return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
    }

    const admin = await requireSystemAdmin();
    adminId = admin.id;
    adminRole = admin.role;

    const body = resetPasswordSchema.parse(await request.json());
    targetUserId = body.userId;

    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(body.userId, {
      password: body.newPassword,
    });

    if (error) {
      await logServerAudit({
        userId: admin.id,
        role: admin.role,
        module: 'users',
        action: 'password_reset',
        recordId: body.userId,
        success: false,
        metadata: { reason: error.message },
      });
      return NextResponse.json({ error: 'Unable to reset password.' }, { status: 400 });
    }

    await logServerAudit({
      userId: admin.id,
      role: admin.role,
      module: 'users',
      action: 'password_reset',
      recordId: body.userId,
      success: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues[0]?.message ?? 'Invalid request';
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (adminId && adminRole && targetUserId) {
      await logServerAudit({
        userId: adminId,
        role: adminRole,
        module: 'users',
        action: 'password_reset',
        recordId: targetUserId,
        success: false,
      }).catch(() => undefined);
    }

    return NextResponse.json({ error: 'Unable to reset password.' }, { status: 500 });
  }
}
