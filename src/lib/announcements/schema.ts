import { z } from 'zod';
import type { AnnouncementPriority, AnnouncementType, TargetAudience } from '@/types/modules';

export const ANNOUNCEMENT_TYPES = ['news', 'circular', 'alert', 'emergency', 'event'] as const;
export const ANNOUNCEMENT_PRIORITIES = ['low', 'normal', 'high', 'critical'] as const;
export const TARGET_AUDIENCES = ['all', 'supervisors', 'technologists', 'quality', 'management'] as const;

export const announcementFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  type: z.enum(ANNOUNCEMENT_TYPES),
  priority: z.enum(ANNOUNCEMENT_PRIORITIES),
  targetAudience: z.enum(TARGET_AUDIENCES),
  expiresAt: z.string().optional(),
  isPinned: z.boolean().default(false),
});

export type AnnouncementFormData = z.infer<typeof announcementFormSchema>;

export function emptyAnnouncementForm(): AnnouncementFormData {
  return {
    title: '',
    content: '',
    type: 'news' as AnnouncementType,
    priority: 'normal' as AnnouncementPriority,
    targetAudience: 'all' as TargetAudience,
    expiresAt: '',
    isPinned: false,
  };
}
