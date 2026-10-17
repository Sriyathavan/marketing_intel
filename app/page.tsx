import { getPlan } from '../lib/getPlan';
import { buildOpportunities } from '../lib/opportunities';
import { buildSegmentProfiles } from '../lib/segments';
import { loadContext, loadCustomers } from '../lib/data';
import CalendarApp from '../components/CalendarApp';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const plan = await getPlan();
  return <CalendarApp key={plan.generatedAt} plan={plan} opportunities={buildOpportunities()} segments={buildSegmentProfiles(loadCustomers())} context={loadContext()} />;
}
