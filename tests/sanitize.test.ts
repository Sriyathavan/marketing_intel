import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { sanitizeDeep, sanitizeText } from '../lib/sanitize';

const BAD = /[\u2014\u2013\u2190-\u21FF\u{1F000}-\u{1FFFF}\u2600-\u27BF]/u;

describe('sanitizer', () => {
  it('replaces dashes, arrows and emojis', () => {
    expect(sanitizeText('Nov 3\u201312')).toBe('Nov 3 to 12');
    expect(sanitizeText('Nov 3 \u2013 Dec 9')).toBe('Nov 3 to Dec 9');
    expect(sanitizeText('Big news \u2014 ski season')).toBe('Big news, ski season');
    expect(sanitizeText('Book \u2192 save')).toBe('Book to save');
    expect(sanitizeText('Go \u{1F3D4}\uFE0F now')).toBe('Go now');
  });
  it('cleans nested values', () => {
    expect(sanitizeDeep({ a: ['x\u2014y', { b: 'a\u2192b' }], n: 3 })).toEqual({ a: ['x, y', { b: 'a to b' }], n: 3 });
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const f = path.join(dir, n);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.(tsx?|json|css)$/.test(n)) out.push(f);
  }
  return out;
}

describe('no forbidden characters in user-visible sources', () => {
  const root = path.resolve(__dirname, '..');
  const files = ['components', 'app', 'lib', 'data'].flatMap((d) => walk(path.join(root, d)));
  it('scans files', () => expect(files.length).toBeGreaterThan(10));
  for (const f of files) {
    it(path.relative(root, f), () => {
      const m = readFileSync(f, 'utf8').split('\n').findIndex((l) => BAD.test(l));
      expect(m, `forbidden character at line ${m + 1}`).toBe(-1);
    });
  }
});
