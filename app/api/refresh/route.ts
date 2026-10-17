import type { RefreshEvent } from '@/lib/types';
import { runPipeline } from '@/lib/pipeline/run';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Re-runs the whole AI workflow and streams one RefreshEvent JSON object per line (NDJSON). */
export async function POST() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: RefreshEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'));
      try {
        if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
        await runPipeline({ onEvent: send });
      } catch (e) {
        send({ stage: 'error', message: (e instanceof Error ? e.message : String(e)).slice(0, 300) });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } });
}
