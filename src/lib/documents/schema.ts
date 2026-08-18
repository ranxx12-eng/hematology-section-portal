import { z } from 'zod';
import type { Document } from '@/types';

export const DOCUMENT_CATEGORIES = ['SOP', 'Policy', 'Form', 'Checklist', 'Manual'] as const;

export const documentFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  documentNumber: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  version: z.string().min(1, 'Version is required').default('1.0'),
  effectiveDate: z.string().min(1, 'Effective date is required'),
  reviewDate: z.string().min(1, 'Review date is required'),
});

export type DocumentFormData = z.infer<typeof documentFormSchema>;

export function emptyDocumentForm(): DocumentFormData {
  const today = new Date().toISOString().slice(0, 10);
  const review = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
  return {
    title: '',
    documentNumber: '',
    category: 'SOP',
    version: '1.0',
    effectiveDate: today,
    reviewDate: review,
  };
}

export interface DocumentVersionInfo {
  version: string;
  fileName: string;
  filePath: string;
  changeNotes?: string;
  uploadedAt: string;
}

export interface DocumentLibraryItem {
  id: string;
  documentNumber: string;
  title: string;
  category: string;
  currentVersion: string;
  versions: DocumentVersionInfo[];
  effectiveDate: string;
  expiryDate?: string;
  ownerId: string;
  status: Document['status'];
  createdAt: string;
  updatedAt: string;
}

export function documentBucketForCategory(category: string): 'sop-documents' | 'policy-documents' {
  const normalized = category.toLowerCase();
  if (normalized.includes('policy')) return 'policy-documents';
  return 'sop-documents';
}
