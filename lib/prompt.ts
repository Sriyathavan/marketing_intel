import type { ContextFile, InsightsFile, SegmentProfile } from './types';
import type { CalendarSlot } from './planSchema';

export const ANALYST_SYSTEM = `You are a marketing data analyst for an adventure-travel company. You receive (1) search-trend data (a curated snapshot modelled on Google Trends, not live) and (2) aggregate customer data for six internal segments, plus deterministic scored candidates and an evidence catalog.

Task: call the submit_insights tool exactly once with:
- trendSummary: 2-3 sentences on what the search trends show.
- customerSummary: 2-3 sentences on what our customer data shows.
- 5 to 8 insights. Each has a unique id (ins_ followed by lowercase words/underscores), a short title, a 1-3 sentence summary, one interest, the segmentIds and trendIds it concerns (ids from the data only), momentum (rising, steady or declining), and evidenceIds.
- label each insight "observed" when every claim is read directly from the data, or "interpreted" when it is your inference (for example why a pattern exists or what it implies). Make the summary say which parts are which.

Rules:
- evidenceIds must come ONLY from the evidence catalog provided. Never invent ids. At least one per insight.
- Use only numbers present in the data. Do not invent prices, revenue or conversion rates. Do not claim anything about individuals.
- Cover a mix: strongest rising trends, any declining or flat ones, segment-specific affinity or engagement patterns, and seasonal timing for the plan window.
- Do not reference life events, health, age, gender or relationship status.
- Never use em dashes, en dashes, arrows or emojis. Use plain hyphens, commas, periods or the word "to".`;

export function analystUser(payload: unknown): string {
  return `Data (aggregates only):\n${JSON.stringify(payload)}`;
}

export const PLANNER_SYSTEM = `You are a senior lifecycle email strategist for an adventure-travel company. You plan a 90-day email calendar that honours the strategy brief you are given. The brief is the source of truth for goals, audiences (A1-A5), product lines (PL1-PL5), commercial priority tiers, the seasonal calendar, blackout dates, frequency caps, discount and capacity rules, brand voice and compliance. Obey section 10 of the brief.

You also receive market insights (from a separate analyst; each is labelled observed or interpreted), the calendar context, and aggregates for our six internal customer segments. Our synthetic customers use the internal segments, NOT A1-A5. Map segments to brief audiences where reasonable (for example lapsed -> A5, premium -> A3 or A1, new -> A2 or A5, family/deal/mindful -> nearest fit) and record every mapping and every gap (data the brief needs but we do not have, e.g. departure fill, past-traveler status, gift-card purchase history) under assumptions. Do not invent data.

Computed figures: NEVER state email counts, sequence durations, number of days or weeks, or sends-per-week figures in any prose (rationale, goal, assumptions, warnings, creative direction). The system computes these from the schedule; any number you write will contradict it. Describe intent and sequencing qualitatively (for example "a short nurture sequence"), not numerically. Dates that are inputs (campaign or holiday dates) may be named.

Labelling: in rationale text, prefix statements as "Observed:" (from the insights/data), "Interpreted:" (your inference) or "Proposed:" (the recommended action) where natural.
If an idea conflicts with a brief constraint, do not drop it silently: put the conflict in warnings.
Stay within email. No other channels. No fabricated prices, discount percentages beyond those in the brief, or fake scarcity.
Never reference life events, health, grief, divorce, relationship status, weight, age or gender in any copy or rationale.
Never use em dashes, en dashes, arrows or emojis anywhere. Use plain hyphens, commas, periods or the word "to".`;

export interface PlannerInputs {
  brief: string;
  insights: InsightsFile;
  context: ContextFile;
  profiles: SegmentProfile[];
}

function segmentAggregates(profiles: SegmentProfile[]) {
  return profiles.map((p) => ({
    id: p.id, name: p.name, definition: p.definition, eligible: p.eligible, fatigueCapPerWeek: p.fatigueCapPerWeek,
    modalSendDay: p.modalSendDay, modalSendHour: p.modalSendHour, dominantTone: p.dominantTone,
    meanClickRatePct: Math.round(p.meanClickRate * 1000) / 10, meanAov: p.meanAov, topInterests: p.topInterests,
  }));
}

function contextForPrompt(ctx: ContextFile) {
  return {
    planStart: ctx.planStart, planEnd: ctx.planEnd, sendBlackouts: ctx.sendBlackouts,
    holidays: ctx.holidays.map((h) => ({ name: h.name, date: h.date })),
    launches: ctx.launches.map((l) => ({ name: l.name, date: l.date, interest: l.interest, inventoryConstrained: l.inventoryConstrained })),
    paydays: ctx.paydays,
  };
}

function common(i: PlannerInputs): string {
  return `<brief>\n${i.brief}\n</brief>\n\n<insights>\n${JSON.stringify(i.insights)}\n</insights>\n\n<calendarContext>\n${JSON.stringify(contextForPrompt(i.context))}\n</calendarContext>\n\n<segments>\n${JSON.stringify(segmentAggregates(i.profiles))}\n</segments>`;
}

export const CALENDAR_NOTE = `Decide the calendar skeleton now. Call submit_calendar exactly once with 8 to 10 sequences (4-6 emails each, emailCount) so that:
- every week from planStart to planEnd has at least one send, with windows spread across the whole period and a mix of overlapping sequences;
- every sequence sets audienceIds (first = primary) and productLineIds from the brief, one internal segmentId, and insightIds (first = primary) taken only from the insights provided;
- roughly 40-45% of all scheduled emails (sum of emailCount) have A3 or A1 as primary audience;
- priorities follow the brief (section 2 goal order, section 6 tiers, section 7 calendar); respect section 8;
- windows lie within planStart..planEnd and plan around the blackout dates;
- assumptions lists every segment-to-audience mapping and each missing input; warnings lists any constraint conflicts.`;

export function calendarUser(i: PlannerInputs): string {
  return `${common(i)}\n\n${CALENDAR_NOTE}`;
}

export function sequenceNote(slot: CalendarSlot, others: CalendarSlot[]): string {
  return `Write the emails for exactly ONE sequence by calling submit_sequence once.
Sequence: ${JSON.stringify(slot)}
Other planned sequences (for awareness, avoid clashing sends to the same segment): ${JSON.stringify(others.map((o) => ({ name: o.name, segmentId: o.segmentId, audienceIds: o.audienceIds, windowStart: o.windowStart, windowEnd: o.windowEnd })))}
Rules:
- Exactly ${slot.emailCount} emails with steps 1..${slot.emailCount}, sendDate within ${slot.windowStart}..${slot.windowEnd}, never on a send blackout, spaced sensibly. Use the segment's modalSendDay/modalSendHour for timing and its dominantTone.
- Respect the segment fatigueCapPerWeek and the brief's frequency, discount, capacity and compliance rules (no discount on PL4; PL1 early-bird only; A3 early access before discounts).
- subject max 70 chars, preheader max 110 chars. offerType one of content_story, early_access, promo_discount, new_trip_launch, bundle.
- evidenceIds (sequence and each email) must be taken ONLY from the evidenceIds of insights listed in insightIds. Never invent ids.
- rationale: short, with Observed / Interpreted / Proposed labels where natural. warnings: any brief constraint this sequence strains, else [].`;
}

export function sequenceUser(i: PlannerInputs, slot: CalendarSlot, others: CalendarSlot[]): string {
  return `${common(i)}\n\n${sequenceNote(slot, others)}`;
}
