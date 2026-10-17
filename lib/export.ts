import type { CampaignPlan, EmailCampaign, EmailSequence, Opportunity, SegmentProfile } from './types';

export const CSV_HEADER =
  'sequence,opportunity,step,send_date,day,send_time_local,segment,audience_size,subject,preheader,creative_direction,cta_label,cta_target,offer_type,rationale,evidence_ids,edited';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayOf = (d: string) => DAYS[new Date(d + 'T00:00:00Z').getUTCDay()];

function cell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function approved(plan: CampaignPlan): { seq: EmailSequence; email: EmailCampaign }[] {
  const out: { seq: EmailSequence; email: EmailCampaign }[] = [];
  for (const seq of plan.sequences) for (const email of seq.emails) if (email.status === 'approved') out.push({ seq, email });
  return out;
}

export function toCsv(plan: CampaignPlan, opps: Opportunity[], segments: SegmentProfile[]): string {
  const oppById = new Map(opps.map((o) => [o.id, o]));
  const segById = new Map(segments.map((s) => [s.id, s]));
  const rows = approved(plan).map(({ seq, email: e }) => {
    const opp = oppById.get(e.opportunityId);
    const seg = segById.get(e.segmentId);
    return [
      seq.name, opp?.title ?? e.opportunityId, e.step, e.sendDate, dayOf(e.sendDate), e.sendTimeLocal,
      seg?.name ?? e.segmentId, seg?.eligible ?? '', e.subject, e.preheader, e.creativeDirection,
      e.cta.label, e.cta.target, e.offerType, e.rationale, e.evidenceIds.join(';'), e.editedByUser ? 'yes' : 'no',
    ].map(cell).join(',');
  });
  return [CSV_HEADER, ...rows].join('\r\n') + '\r\n';
}

export function toMarkdown(plan: CampaignPlan, opps: Opportunity[], segments: SegmentProfile[]): string {
  const items = approved(plan);
  const oppById = new Map(opps.map((o) => [o.id, o]));
  const segById = new Map(segments.map((s) => [s.id, s]));
  const L: string[] = [];
  L.push(`# Marketing plan`, '', `Window: ${plan.planStart} to ${plan.planEnd}`, '');

  const seqs = plan.sequences.filter((s) => items.some((i) => i.seq === s));
  for (const seq of seqs) {
    const opp = oppById.get(seq.opportunityId);
    const seg = segById.get(seq.segmentId);
    L.push(`## ${opp?.title ?? seq.name}`, '');
    L.push(`Sequence: ${seq.name}`, `Goal: ${seq.goal}`);
    if (seg) L.push(`Segment: ${seg.name} (${seg.eligible} eligible)`);
    if (opp) {
      L.push(`Score: ${opp.score.total}`, '', '| Factor | Weight | Score | Contribution |', '|---|---|---|---|');
      for (const f of opp.score.factors) L.push(`| ${f.label} | ${f.weight} | ${f.score} | ${f.contribution} |`);
    }
    L.push('');
  }

  L.push('## Calendar', '', '| Week | Date | Sequence | Subject |', '|---|---|---|---|');
  const sorted = [...items].sort((a, b) => a.email.sendDate.localeCompare(b.email.sendDate) || a.email.step - b.email.step);
  const t0 = Date.parse(plan.planStart + 'T00:00:00Z');
  const esc = (s: string) => s.replace(/\|/g, '\\|');
  for (const { seq, email: e } of sorted) {
    const week = Math.floor((Date.parse(e.sendDate + 'T00:00:00Z') - t0) / (7 * 86400000)) + 1;
    L.push(`| ${week} | ${e.sendDate} (${dayOf(e.sendDate)}) | ${esc(seq.name)} | ${esc(e.subject)} |`);
  }
  L.push('');

  L.push('## Email details', '');
  for (const seq of seqs) {
    const opp = oppById.get(seq.opportunityId);
    const labels = new Map((opp?.evidence ?? []).map((ev) => [ev.id, `${ev.label}: ${ev.value}${ev.unit ?? ''}`]));
    L.push(`### ${seq.name}`, '');
    for (const { email: e } of items.filter((i) => i.seq === seq)) {
      L.push(`#### Step ${e.step}: ${e.subject}`, '',
        `- Send: ${e.sendDate} ${e.sendTimeLocal} (local)`,
        `- Preheader: ${e.preheader}`,
        `- Creative direction: ${e.creativeDirection}`,
        `- CTA: ${e.cta.label} -> ${e.cta.target}`,
        `- Offer type: ${e.offerType}`,
        `- Rationale: ${e.rationale}`,
        `- Evidence: ${e.evidenceIds.map((id) => labels.get(id) ?? id).join('; ')}`, '');
    }
  }

  L.push('## Suppression and privacy', '');
  for (const seq of seqs) L.push(`- ${seq.name}: ${seq.suppressionNote}`);
  L.push('', 'Sensitive signals (life events such as divorce, bereavement, health journey) are used for suppression only and never for targeting or copy.', '');
  return L.join('\n');
}
