import Link from 'next/link';
import { loadCustomers, loadTrends } from '../../lib/data';
import { buildDashboard, ENGAGEMENT_STATES } from '../../lib/dashboard';
import { buildOpportunities } from '../../lib/opportunities';
import { buttonVariants } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import { Card, Section } from '../../components/dashboard/Section';
import TrendChart from '../../components/dashboard/TrendChart';
import BarList from '../../components/dashboard/BarList';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const ENG_STYLE: Record<(typeof ENGAGEMENT_STATES)[number], { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: '#4338ca', text: '#fff' },
  reactivated: { label: 'Reactivated', bg: '#a5b4fc', text: '#18181b' },
  cooling: { label: 'Cooling', bg: '#d9e3df', text: '#18181b' },
  dormant: { label: 'Dormant', bg: '#aebbb5', text: '#18181b' },
};

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard · Marketing Intelligence Engine' };

export default async function Dashboard() {
  const { trends, customers } = buildDashboard(loadTrends(), loadCustomers());
  const opps = buildOpportunities();
  const maxYoy = Math.max(...trends.ranking.map(r => r.yoyPct), 1);
  const trendsSource = `Curated trends snapshot (not live) · ${trends.capturedAt}`;

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-10">
      <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            What is rising in search, who we can reach, and which opportunities score highest. The 90-day calendar is built from the ranked opportunities below.
          </p>
        </div>
        <Link href="/" className={buttonVariants()}>View calendar</Link>
      </div>

      <Section title="Search trends" description="Interest over time for the fastest-rising keywords, index 0 to 100, US." source={trendsSource}>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Top 5 rising keywords" subtitle="Monthly search interest, last 24 months" className="lg:col-span-2">
            <TrendChart trends={trends} />
          </Card>
          <div className="flex flex-col">
            <Card title="Keywords by year-over-year change" className="h-full">
              <ol className="space-y-2.5">
                {trends.ranking.map(r => (
                  <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                    <span className="truncate text-[13px]" title={r.term}>{r.term}</span>
                    <span className="tabular text-[13px] font-semibold">{r.yoyPct > 0 ? '+' : ''}{r.yoyPct}%</span>
                    <span aria-hidden className="col-span-2 h-1 rounded-full bg-muted">
                      <span className="block h-1 rounded-full bg-accent" style={{ width: `${Math.max(0, r.yoyPct) / maxYoy * 100}%` }} />
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
        <Card title="Top rising queries" subtitle="Related queries with the fastest growth" className="mt-4">
          <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
            {trends.risingQueries.map(q => (
              <li key={q.query} className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 text-[13px]">
                <span><span className="font-medium">{q.query}</span> <span className="text-muted-foreground">· {q.keyword}</span></span>
                <span className="tabular shrink-0 font-semibold">{q.growth === 'breakout' ? 'Breakout' : `+${q.growth}%`}</span>
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Section title="Our customers" description="Who we can reach, how engaged they are, and what they care about. Email-eligible members only."
        source="Synthetic customer data">
        <dl className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            ['Customers', customers.total, 'In the synthetic file'],
            ['Email-eligible', customers.eligible, 'Opted in, not suppressed'],
            ['Opted out', customers.optedOut, 'Never emailed'],
            ['Suppressed', customers.suppressed, 'Sensitive life events; suppression only'],
          ].map(([k, v, hint]) => (
            <div key={k as string} className="rounded-lg border border-border bg-surface p-5">
              <dt className="text-xs font-medium text-muted-foreground">{k}</dt>
              <dd className="tabular mt-1 text-2xl font-semibold tracking-tight">{v}</dd>
              <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
            </div>
          ))}
        </dl>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Eligible members by segment">
            <BarList ariaLabel="Eligible members by segment" data={customers.segments.map(s => ({ name: s.name, value: s.eligible }))} />
          </Card>
          <Card title="Email click rate by segment" subtitle="Mean 30-day click rate">
            <BarList ariaLabel="Mean click rate by segment" unit="%" data={customers.segments.map(s => ({ name: s.name, value: s.clickRatePct }))} />
          </Card>
          <Card title="Email engagement mix by segment" subtitle="Share of eligible members by engagement trend">
            <ul className="space-y-3">
              {customers.segments.map(s => (
                <li key={s.id}>
                  <div className="mb-1 text-[13px] font-medium">{s.name}</div>
                  <div className="flex h-6 overflow-hidden rounded-sm bg-muted" role="img"
                    aria-label={ENGAGEMENT_STATES.map(k => `${ENG_STYLE[k].label} ${pct(s.engagement[k])}`).join(', ')}>
                    {ENGAGEMENT_STATES.map(k => s.engagement[k] > 0 && (
                      <span key={k} title={`${ENG_STYLE[k].label} ${pct(s.engagement[k])}`} className="tabular flex items-center justify-center overflow-hidden text-[10px] font-semibold"
                        style={{ width: `${s.engagement[k] * 100}%`, background: ENG_STYLE[k].bg, color: ENG_STYLE[k].text }}>
                        {s.engagement[k] >= 0.045 ? pct(s.engagement[k]) : ''}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {ENGAGEMENT_STATES.map(k => (
                <span key={k} className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ background: ENG_STYLE[k].bg }} />{ENG_STYLE[k].label}</span>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Scored opportunities" description="Ranked by a weighted score. These five opportunities are the basis of the calendar."
        source="Scores computed from the data above"
        action={<Link href="/" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>View calendar</Link>}>
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[900px] text-left text-[13px]">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="w-10 py-3 pl-5 font-medium">#</th>
                <th scope="col" className="py-3 font-medium">Opportunity</th>
                <th scope="col" className="py-3 pr-4 text-right font-medium">Score</th>
                {opps[0]?.score.factors.map(f => (
                  <th key={f.key} scope="col" className="w-[104px] py-3 pr-4 font-medium">{f.label}<span className="block font-normal">{Math.round(f.weight * 100)}% weight</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {opps.map(o => (
                <tr key={o.id} className="border-b border-border last:border-0 align-top">
                  <td className="tabular py-3.5 pl-5 text-muted-foreground">{o.rank}</td>
                  <td className="max-w-[340px] py-3.5 pr-4">
                    <div className="font-medium">{o.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{o.reachable} reachable members</div>
                  </td>
                  <td className="tabular py-3.5 pr-4 text-right text-base font-semibold">{o.score.total}</td>
                  {o.score.factors.map(f => (
                    <td key={f.key} className="py-3.5 pr-4">
                      <div className="tabular font-medium">{f.score}</div>
                      <div aria-hidden className="mt-1 h-1 rounded-full bg-muted"><div className="h-1 rounded-full bg-accent" style={{ width: `${f.score}%` }} /></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Factor scores are 0 to 100. Effort and risk is inverted: higher means lower effort and fatigue risk.</p>
      </Section>
    </main>
  );
}
