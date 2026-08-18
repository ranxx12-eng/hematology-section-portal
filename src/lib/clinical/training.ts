import { createClient } from '@/lib/supabase/client';
import type { TrainingCourseFormData } from '@/lib/training/schema';
import type { TrainingCourse } from '@/types';
import { runClinicalListQuery, runClinicalMutation, type ClinicalListResult, type ClinicalResult } from './result';

interface TrainingCourseRow {
  id: string;
  title: string;
  description: string;
  category: string;
  instructor: string;
  start_date: string;
  due_date: string;
  content: string | null;
  passing_score: number;
  status: TrainingCourse['status'];
  created_at: string;
}

function mapTrainingCourse(row: TrainingCourseRow): TrainingCourse {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    instructor: row.instructor,
    startDate: row.start_date,
    dueDate: row.due_date,
    content: row.content ?? undefined,
    passingScore: row.passing_score,
    status: row.status,
    createdAt: row.created_at,
  };
}

function formToInsertRow(form: TrainingCourseFormData, userId: string) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    category: form.category,
    instructor: form.instructor.trim(),
    start_date: form.startDate,
    due_date: form.dueDate,
    passing_score: form.passingScore,
    status: form.status,
    created_by: userId,
  };
}

const TRAINING_SELECT = '*';

export async function fetchTrainingCourses(): Promise<ClinicalListResult<TrainingCourse>> {
  return runClinicalListQuery('Failed to load training courses', async () => {
    const supabase = createClient();
    return supabase
      .from('training_courses')
      .select(TRAINING_SELECT)
      .is('deleted_at', null)
      .order('due_date', { ascending: true });
  }).then((result) => ({
    data: (result.data as unknown as TrainingCourseRow[]).map(mapTrainingCourse),
    error: result.error,
  }));
}

export async function createTrainingCourse(
  userId: string,
  form: TrainingCourseFormData,
): Promise<ClinicalResult<TrainingCourse>> {
  return runClinicalMutation('Failed to create training course', async () => {
    const supabase = createClient();
    return supabase
      .from('training_courses')
      .insert(formToInsertRow(form, userId))
      .select(TRAINING_SELECT)
      .single();
  }).then((result) => ({
    data: result.data ? mapTrainingCourse(result.data as unknown as TrainingCourseRow) : null,
    error: result.error,
  }));
}

export async function softDeleteTrainingCourse(id: string): Promise<{ error: string | null }> {
  const result = await runClinicalMutation('Failed to delete training course', async () => {
    const supabase = createClient();
    return supabase
      .from('training_courses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();
  });
  return { error: result.error };
}
