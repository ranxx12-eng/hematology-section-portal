import { z } from 'zod';

export const meetingFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  location: z.string().min(1, 'Location is required'),
  agenda: z.string().min(1, 'Agenda is required'),
});

export type MeetingFormData = z.infer<typeof meetingFormSchema>;

export function emptyMeetingForm(): MeetingFormData {
  return {
    title: '',
    date: new Date().toISOString().slice(0, 10),
    time: '10:00',
    location: 'Conference Room A',
    agenda: '',
  };
}
