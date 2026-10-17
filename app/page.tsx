import { getPlan } from '../lib/getPlan';
import { getInsights } from '../lib/getInsights';
import { buildAllOpportunities, buildOpportunities } from '../lib/opportunities';
import { buildSegmentProfiles } from '../lib/segments';
import { loadContext, loadCustomers } from '../lib/data';
import CalendarApp from '../components/CalendarApp';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const plan = await getPlan();
  const insights = (await getInsights().catch(() => null))?.insights ?? [];
  const evidence = Object.fromEntries(buildAllOpportunities().flatMap(o => o.evidence).map(e => [e.id, e]));
  return <CalendarApp key={plan.generatedAt} plan={plan} opportunities={buildOpportunities()} evidence={evidence} insights={insights} segments={buildSegmentProfiles(loadCustomers())} context={loadContext()} />;
}
