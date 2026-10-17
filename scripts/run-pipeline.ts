// Runs the AI workflow (analyst -> planner) and writes data/insights.json + data/cached-plan.json.
// Run: npm run pipeline [-- --analyst-model <id> --planner-model <id> --analyst-thinking disabled|between_tools --planner-thinking ... --no-write]
import { join } from 'node:path';
import { runPipeline } from '../lib/pipeline/run';
import type { Thinking } from '../lib/pipeline/llm';

try { process.loadEnvFile(join(process.cwd(), '.env.local')); } catch { /* key may already be in env */ }

const args = process.argv.slice(2);
const arg = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

async function main() {
  const r = await runPipeline({
    analystModel: arg('--analyst-model'),
    plannerModel: arg('--planner-model'),
    analystThinking: arg('--analyst-thinking') as Thinking | undefined,
    plannerThinking: arg('--planner-thinking') as Thinking | undefined,
    write: !args.includes('--no-write'),
    onEvent: (e) => console.log(JSON.stringify(e)),
  });
  const emails = r.plan.sequences.reduce((n, s) => n + s.emails.length, 0);
  const s = (ms: number) => (ms / 1000).toFixed(1) + 's';
  console.log(`insights=${r.insights.insights.length} (${r.insights.model}) sequences=${r.plan.sequences.length} emails=${emails} (${r.plan.model}) analyst=${s(r.timingsMs.analyst)} planner=${s(r.timingsMs.planner)} total=${s(r.timingsMs.total)} warnings=${r.plan.warnings.length}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
