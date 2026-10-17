import trendsJson from '../data/trends.json';
import customersJson from '../data/customers.json';
import contextJson from '../data/context.json';
import type { ContextFile, Customer, TrendsFile } from './types';

export function loadTrends(): TrendsFile {
  return trendsJson as unknown as TrendsFile;
}
export function loadCustomers(): Customer[] {
  return customersJson as unknown as Customer[];
}
export function loadContext(): ContextFile {
  return contextJson as unknown as ContextFile;
}
