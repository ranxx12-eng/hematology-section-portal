import { createClient } from '@/lib/supabase/client';

export interface SearchResultItem {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export async function searchPortal(
  query: string,
  locale: string,
): Promise<{ data: SearchResultItem[]; error: string | null }> {
  const q = query.trim();
  if (q.length < 2) return { data: [], error: null };

  const pattern = `%${q}%`;
  const supabase = createClient();

  try {
    const [employees, tasks, instruments, documents, qc] = await Promise.all([
      supabase.from('employees').select('id, full_name, job_title, email, employee_code').is('deleted_at', null).or(`full_name.ilike.${pattern},email.ilike.${pattern},employee_code.ilike.${pattern}`).limit(5),
      supabase.from('tasks').select('id, title, status').is('deleted_at', null).ilike('title', pattern).limit(5),
      supabase.from('instruments').select('id, name, serial_number').is('deleted_at', null).or(`name.ilike.${pattern},serial_number.ilike.${pattern}`).limit(5),
      supabase.from('documents').select('id, title, document_number').is('deleted_at', null).or(`title.ilike.${pattern},document_number.ilike.${pattern}`).limit(5),
      supabase.from('qc_records').select('id, test_name, qc_status').is('deleted_at', null).ilike('test_name', pattern).limit(5),
    ]);

    const items: SearchResultItem[] = [];
    for (const row of employees.data ?? []) {
      items.push({ type: 'Employee', id: row.id, title: row.full_name, subtitle: row.job_title, href: `/${locale}/employees/${row.id}` });
    }
    for (const row of tasks.data ?? []) {
      items.push({ type: 'Task', id: row.id, title: row.title, subtitle: row.status, href: `/${locale}/tasks` });
    }
    for (const row of instruments.data ?? []) {
      items.push({ type: 'Instrument', id: row.id, title: row.name, subtitle: row.serial_number, href: `/${locale}/instruments/${row.id}` });
    }
    for (const row of documents.data ?? []) {
      items.push({ type: 'Document', id: row.id, title: row.title, subtitle: row.document_number, href: `/${locale}/documents` });
    }
    for (const row of qc.data ?? []) {
      items.push({ type: 'QC', id: row.id, title: row.test_name, subtitle: row.qc_status, href: `/${locale}/quality-control` });
    }

    return { data: items.slice(0, 20), error: null };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err.message : 'Search failed',
    };
  }
}
