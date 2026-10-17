import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ContextFile, Customer, TrendsFile } from './types';

// Read from disk on every call (no module cache) so a refresh is visible without restarting the server.
function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(process.cwd(), 'data', name), 'utf8')) as T;
}

export function loadTrends(): TrendsFile {
  return readJson<TrendsFile>('trends.json');
}
export function loadCustomers(): Customer[] {
  return readJson<Customer[]>('customers.json');
}
export function loadContext(): ContextFile {
  return readJson<ContextFile>('context.json');
}
