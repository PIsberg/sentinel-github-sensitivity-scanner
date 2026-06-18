import { describe, it, expect } from 'vitest';
import { cleanToken, parseUnifiedDiff } from './utils';

describe('cleanToken', () => {
  it('returns an empty string for undefined, empty or whitespace input', () => {
    expect(cleanToken(undefined)).toBe('');
    expect(cleanToken('')).toBe('');
    expect(cleanToken('   ')).toBe('');
  });

  it('strips a case-insensitive "Bearer " prefix', () => {
    expect(cleanToken('Bearer abc123')).toBe('abc123');
    expect(cleanToken('bearer abc123')).toBe('abc123');
  });

  it('strips a case-insensitive "token " prefix', () => {
    expect(cleanToken('token abc123')).toBe('abc123');
    expect(cleanToken('TOKEN abc123')).toBe('abc123');
  });

  it('trims surrounding whitespace and leaves a bare token untouched', () => {
    expect(cleanToken('  ghp_xyz  ')).toBe('ghp_xyz');
  });
});

describe('parseUnifiedDiff', () => {
  it('splits a multi-file diff and extracts the new filename from the +++ header', () => {
    const raw = [
      'diff --git a/one.txt b/one.txt',
      '--- a/one.txt',
      '+++ b/one.txt',
      '@@ -0,0 +1 @@',
      '+hello',
      'diff --git a/two.txt b/two.txt',
      '--- a/two.txt',
      '+++ b/two.txt',
      '@@ -0,0 +1 @@',
      '+world',
    ].join('\n');

    const files = parseUnifiedDiff(raw);
    expect(files.map(f => f.filename)).toEqual(['one.txt', 'two.txt']);
    expect(files[0].patch).toContain('+hello');
    expect(files[1].patch).toContain('+world');
  });

  it('returns an empty array for an empty diff', () => {
    expect(parseUnifiedDiff('')).toEqual([]);
  });
});
