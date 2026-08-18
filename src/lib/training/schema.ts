import { z } from 'zod';
import type { TrainingCourse } from '@/types';

export const TRAINING_STATUSES = ['draft', 'active', 'archived'] as const;

export const trainingCourseFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.string().min(1, 'Category is required'),
  instructor: z.string().min(1, 'Instructor is required'),
  startDate: z.string().min(1, 'Start date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  passingScore: z.coerce.number().min(0).max(100).default(80),
  status: z.enum(TRAINING_STATUSES).default('active'),
});

export type TrainingCourseFormData = z.infer<typeof trainingCourseFormSchema>;

export function emptyTrainingCourseForm(): TrainingCourseFormData {
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  return {
    title: '',
    description: '',
    category: 'SOP',
    instructor: '',
    startDate: today,
    dueDate: due,
    passingScore: 80,
    status: 'active',
  };
}

export function courseToForm(course: TrainingCourse): TrainingCourseFormData {
  return {
    title: course.title,
    description: course.description,
    category: course.category,
    instructor: course.instructor,
    startDate: course.startDate.slice(0, 10),
    dueDate: course.dueDate.slice(0, 10),
    passingScore: course.passingScore,
    status: course.status,
  };
}
