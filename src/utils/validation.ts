/** Zod schemas guarding every write path into the database. */
import { z } from 'zod';
import { defaultPageSetup } from '@/types/models';
import type { AccentName } from '@/design/tokens';

export const accentSchema = z.enum([
  'purple',
  'blue',
  'green',
  'amber',
  'pink',
  'teal',
  'orange',
  'red',
]);

export const pageSetupSchema = z.object({
  orientation: z.enum(['portrait', 'landscape']),
  paperSize: z.enum(['A4', 'A5', 'Letter', 'Legal']),
  margins: z.object({
    top: z.number().min(0).max(288),
    right: z.number().min(0).max(288),
    bottom: z.number().min(0).max(288),
    left: z.number().min(0).max(288),
  }),
  pageColor: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i),
  headerText: z.string().max(200),
  footerText: z.string().max(200),
  pageNumbers: z.boolean(),
  lineHeight: z.number().min(1).max(3),
});

export const notebookInputSchema = z.object({
  name: z.string().trim().min(1, 'Notebook name is required').max(60),
  color: accentSchema.default('purple'),
  icon: z.string().min(1).default('book'),
});

export const documentInputSchema = z.object({
  notebookId: z.string().min(1),
  title: z.string().max(200).default(''),
  contentHtml: z.string().default(''),
  cardColor: accentSchema.default('purple'),
  pageSetup: pageSetupSchema.default(defaultPageSetup),
});

export const tagInputSchema = z.object({
  name: z.string().trim().min(1).max(32),
  color: accentSchema.default('purple'),
});

export const commentInputSchema = z.object({
  documentId: z.string().min(1),
  body: z.string().trim().min(1, 'Comment cannot be empty').max(2000),
  quote: z.string().max(500).nullable().default(null),
  author: z.string().min(1).default('You'),
});

export const bookmarkInputSchema = z.object({
  documentId: z.string().min(1),
  label: z.string().trim().min(1).max(80),
  anchor: z.string().min(1),
});

export const pinSchema = z
  .string()
  .regex(/^\d{4,8}$/, 'PIN must be 4-8 digits');

export function parsePageSetup(raw: unknown) {
  const parsed = pageSetupSchema.safeParse(
    typeof raw === 'string' ? safeJsonParse(raw, {}) : raw,
  );
  return parsed.success ? parsed.data : defaultPageSetup;
}

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function validationMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? 'Invalid input';
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}

export type NotebookInput = z.infer<typeof notebookInputSchema>;
export type DocumentInput = z.infer<typeof documentInputSchema>;
export type AccentInput = AccentName;
