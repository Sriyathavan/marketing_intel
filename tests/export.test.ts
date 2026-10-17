import { describe, it, expect } from 'vitest';
import { toCsv, toMarkdown, CSV_HEADER } from '@/lib/export';
import { opp, profile, cachedPlanFor } from './_planFixtures';
import type { EmailCampaign } from '@/lib/types';

const o = opp(1);
const segs = [profile('seg_family')];
function email(n: number, over: Partial<EmailCampaign> = {}): EmailCampaign {
  return {
    id: `em_${n}`, sequenceId: `seq_${o.id}`, opportunityId: o.id, segmentId: 'seg_family', step: n,
    sendDate: '2026-11-03', sendTimeLocal: '07:00', subject: `Sub ${n}`, preheader: 'p', creativeDirection: 'cd',
    cta: { label: 'Go', target: '/t' }, offerType: 'bundle', rationale: 'r', evidenceIds: [o.evidence[0].id, o.evidence[1].id],
    status: 'proposed', editedByUser: false, guardrailFlags: [], ...over,
  };
}
function plan(emails: EmailCampaign[]) {
  const p = cachedPlanFor([o]);
  p.sequences[0].name = 'Family seq';
  p.sequences[0].emails = emails;
  p.sequences[0].suppressionNote = '4 of 40 segment members (10%) excluded for sensitive life events; used for suppression only';
  return p;
}

describe('toCsv', () => {
  it('has exact header, CRLF and approved only', () => {
    const csv = toCsv(plan([email(1, { status: 'approved' }), email(2), email(3, { status: 'rejected' })]), [o], segs);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(CSV_HEADER);
    expect(CSV_HEADER).toBe('sequence,opportunity,step,send_date,day,send_time_local,segment,audience_size,subject,preheader,creative_direction,cta_label,cta_target,offer_type,rationale,evidence_ids,edited');
    expect(lines.filter(Boolean)).toHaveLength(2);
    expect(lines[1]).toContain('Tue'); // 2026-11-03
    expect(lines[1]).toContain(`${o.evidence[0].id};${o.evidence[1].id}`);
    expect(lines[1].endsWith(',no')).toBe(true);
  });
  it('quotes commas, quotes and newlines', () => {
    const csv = toCsv(plan([email(1, { status: 'approved', subject: 'Hi, "you"', creativeDirection: 'a\nb' })]), [o], segs);
    expect(csv).toContain('"Hi, ""you"""');
    expect(csv).toContain('"a\nb"');
  });
  it('guards formula injection', () => {
    const csv = toCsv(plan([email(1, { status: 'approved', subject: '=SUM(A1)', preheader: '@x', rationale: '-1', creativeDirection: '+1' })]), [o], segs);
    expect(csv).toContain(",'=SUM(A1),");
    expect(csv).toContain(",'@x,");
    expect(csv).toContain(",'+1,");
    expect(csv).toContain(",'-1,");
  });
  it('flags edited', () => {
    expect(toCsv(plan([email(1, { status: 'approved', editedByUser: true })]), [o], segs).trimEnd().endsWith(',yes')).toBe(true);
  });
  it('header only when nothing approved', () => {
    expect(toCsv(plan([email(1)]), [o], segs)).toBe(CSV_HEADER + '\r\n');
  });
});

describe('toMarkdown', () => {
  it('includes approved only, suppression note and statement', () => {
    const md = toMarkdown(plan([email(1, { status: 'approved', subject: 'Approved one' }), email(2, { subject: 'Proposed two' })]), [o], segs);
    expect(md).toContain('Approved one');
    expect(md).not.toContain('Proposed two');
    expect(md).toContain('| Trend momentum | 0.25 | 80 | 20 |');
    expect(md).toContain('Score: 70');
    expect(md).toContain('| Week | Date | Sequence | Subject |');
    expect(md).toContain('Label 1: 1');
    expect(md).toContain('4 of 40 segment members (10%) excluded');
    expect(md).toContain('used for suppression only');
    expect(md).toContain('2026-11-02 to 2027-01-30');
  });
});
