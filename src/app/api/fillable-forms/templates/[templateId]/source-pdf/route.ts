import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FILLABLE_FORMS_BUCKET, HEMA_001_BUNDLED_PDF, HEMA_001_TEMPLATE_ID } from '@/lib/fillable-pdf/schema';

export const dynamic = 'force-dynamic';

async function loadBundledPdf(): Promise<Buffer> {
  const filePath = path.join(process.cwd(), 'private/fillable-forms/templates/Form-Hema-001-Routine-Tests-Form.pdf');
  return readFile(filePath);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let storagePath = templateId === HEMA_001_TEMPLATE_ID ? HEMA_001_BUNDLED_PDF : null;

  const { data: template } = await supabase
    .from('fillable_pdf_templates')
    .select('source_pdf_path, status, is_published')
    .eq('id', templateId)
    .is('deleted_at', null)
    .maybeSingle();

  if (template?.source_pdf_path) storagePath = template.source_pdf_path;

  if (storagePath) {
    const { data, error } = await supabase.storage.from(FILLABLE_FORMS_BUCKET).download(storagePath);
    if (!error && data) {
      const bytes = Buffer.from(await data.arrayBuffer());
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Cache-Control': 'private, no-store',
        },
      });
    }
  }

  if (templateId === HEMA_001_TEMPLATE_ID) {
    try {
      const bytes = await loadBundledPdf();
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Cache-Control': 'private, no-store',
        },
      });
    } catch {
      return NextResponse.json({ error: 'Template PDF not found' }, { status: 404 });
    }
  }

  return NextResponse.json({ error: 'Template PDF not found' }, { status: 404 });
}
