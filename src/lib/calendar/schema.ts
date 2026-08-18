import { z } from 'zod';
import type { CalendarEventType } from '@/types/modules';

export const CALENDAR_EVENT_TYPES = [
  'meeting', 'training', 'maintenance', 'cap_visit', 'cbahi', 'holiday', 'staff_schedule',
] as const;

export const calendarEventFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(CALENDAR_EVENT_TYPES),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
});

export type CalendarEventFormData = z.infer<typeof calendarEventFormSchema>;

export function emptyCalendarEventForm(): CalendarEventFormData {
  return {
    title: '',
    type: 'meeting' as CalendarEventType,
    startDate: '',
    endDate: '',
    location: '',
    description: '',
  };
}
