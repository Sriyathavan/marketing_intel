import { z } from 'zod';
import { INTERESTS } from './types';

export const OFFER_TYPES = ['content_story', 'early_access', 'promo_discount', 'new_trip_launch', 'bundle'] as const;
export const SEGMENT_ID_VALUES = ['seg_lapsed', 'seg_new', 'seg_premium', 'seg_family', 'seg_deal', 'seg_mindful'] as const;
/** Audiences and product lines defined in 'Email strategy Brief.md' (sections 3 and 5). */
export const AUDIENCE_IDS = ['A1', 'A2', 'A3', 'A4', 'A5'] as const;
export const PRODUCT_LINE_IDS = ['PL1', 'PL2', 'PL3', 'PL4', 'PL5'] as const;

// ---------- Step 1: analyst output ----------
export const ModelInsightSchema = z.object({
  id: z.string().regex(/^ins_[a-z0-9_]+$/),
  title: z.string().min(1).max(90),
  summary: z.string().min(1),
  interest: z.enum(INTERESTS),
  segmentIds: z.array(z.enum(SEGMENT_ID_VALUES)),
  trendIds: z.array(z.string()),
  momentum: z.enum(['rising', 'steady', 'declining']),
  label: z.enum(['observed', 'interpreted']),
  evidenceIds: z.array(z.string()).min(1),
});
export const ModelInsightsSchema = z.object({
  trendSummary: z.string().min(1),
  customerSummary: z.string().min(1),
  insights: z.array(ModelInsightSchema).min(5).max(8),
});
export type ModelInsights = z.infer<typeof ModelInsightsSchema>;

// ---------- Step 2a: planner calendar (which sequences, when, for whom) ----------
export const CalendarSlotSchema = z.object({
  key: z.string().regex(/^s\d{1,2}$/),
  name: z.string().min(1),
  goal: z.string().min(1),
  segmentId: z.enum(SEGMENT_ID_VALUES),
  /** First entry is the primary audience. */
  audienceIds: z.array(z.enum(AUDIENCE_IDS)).min(1),
  productLineIds: z.array(z.enum(PRODUCT_LINE_IDS)).min(1),
  /** First entry is the primary insight. */
  insightIds: z.array(z.string()).min(1),
  windowStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  windowEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  emailCount: z.number().int().min(4).max(6),
});
export const CalendarSchema = z.object({
  sequences: z.array(CalendarSlotSchema).min(6).max(12),
  assumptions: z.array(z.string()).min(1),
  warnings: z.array(z.string()),
});
export type CalendarSlot = z.infer<typeof CalendarSlotSchema>;
export type ModelCalendar = z.infer<typeof CalendarSchema>;

// ---------- Step 2b: one sequence's emails ----------
export const ModelEmailSchema = z.object({
  step: z.number().int().min(1).max(6),
  sendDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sendTimeLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  subject: z.string().min(1).max(70),
  preheader: z.string().min(1).max(110),
  creativeDirection: z.string().min(1),
  cta: z.object({ label: z.string().min(1), target: z.string().min(1) }),
  offerType: z.enum(OFFER_TYPES),
  rationale: z.string().min(1),
  evidenceIds: z.array(z.string()).min(1),
});
export const ModelSequenceSchema = z.object({
  rationale: z.string().min(1),
  evidenceIds: z.array(z.string()),
  /** Constraint conflicts the planner noticed (brief section 8). */
  warnings: z.array(z.string()),
  emails: z.array(ModelEmailSchema).min(4).max(6),
});
export type ModelSequence = z.infer<typeof ModelSequenceSchema>;
export type ModelEmail = z.infer<typeof ModelEmailSchema>;

/** JSON schema for a forced tool input (object root). */
export function toolJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const s = z.toJSONSchema(schema) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

export function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
}
