import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';
import { formatZodError, toolJsonSchema } from '../planSchema';

export type Thinking = 'disabled' | 'between_tools' | null;

export interface LlmOptions {
  model: string;
  /** 'disabled' (haiku), 'between_tools' (sonnet), or null to send no thinking param. */
  thinking?: Thinking;
  client?: Anthropic;
}

export interface ToolCall<T> {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  schema: z.ZodType<T>;
  /** Extra semantic validation; return an error message to make the model retry. */
  validate?: (value: T) => string | null;
  maxTokens?: number;
}

/**
 * One streamed Claude call that must end in a tool call with schema-valid input.
 * tool_choice is 'auto' (forced tool choice is rejected by the model), so the prompt tells it to call the tool.
 * Retries once with the validation error fed back.
 */
export async function callTool<T>(opts: LlmOptions, call: ToolCall<T>): Promise<T> {
  const client = opts.client ?? new Anthropic();
  const tools = [{ name: call.toolName, description: call.toolDescription, input_schema: toolJsonSchema(call.schema) as Anthropic.Tool.InputSchema }];
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: call.user }];
  const thinking = opts.thinking === undefined ? 'disabled' : opts.thinking;
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.messages.stream(
      {
        model: opts.model,
        max_tokens: call.maxTokens ?? 8000,
        system: call.system,
        tools,
        tool_choice: { type: 'auto' },
        ...(thinking ? { thinking: { type: thinking } as Anthropic.MessageCreateParams['thinking'] } : {}),
        messages,
      },
      { timeout: 120000 },
    ).finalMessage();
    const block = res.content.find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') {
      lastError = `No ${call.toolName} tool call returned`;
      messages.push({ role: 'assistant', content: res.content }, { role: 'user', content: `Error: ${lastError}. Call ${call.toolName}.` });
      continue;
    }
    const parsed = call.schema.safeParse(block.input);
    const semantic = parsed.success ? call.validate?.(parsed.data) ?? null : null;
    if (parsed.success && !semantic) return parsed.data;
    lastError = parsed.success ? semantic! : formatZodError(parsed.error);
    messages.push(
      { role: 'assistant', content: res.content },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: block.id, is_error: true, content: `Validation failed. Fix and resubmit:\n${lastError}` }] },
    );
  }
  throw new Error(`invalid_output (${call.toolName}): ${lastError.slice(0, 300)}`);
}
