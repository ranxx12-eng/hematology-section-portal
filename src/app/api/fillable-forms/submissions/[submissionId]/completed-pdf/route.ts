import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FILLABLE_FORMS_BUCKET } from '@/lib/fillable-pdf/schema';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: submission, error } = await supabase
    .from('fillable_pdf_submissions')
    .select('completed_pdf_path')
    .eq('id', submissionId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !submission?.completed_pdf_path) {
    return NextResponse.json({ error: 'Completed PDF not found' }, { status: 404 });
  }

  const { data, error: downloadError } = await supabase.storage
    .from(FILLABLE_FORMS_BUCKET)
    .download(submission.completed_pdf_path);

  if (downloadError || !data) {
    return NextResponse.json({ error: 'Completed PDF not found' }, { status: 404 });
  }

  const bytes = Buffer.from(await data.arrayBuffer());
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="completed-${submissionId}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
