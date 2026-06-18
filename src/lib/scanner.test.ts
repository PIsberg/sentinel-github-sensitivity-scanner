import { describe, it, expect } from 'vitest';
import { scanContent, scanDiff, extractAddedLines } from './scanner';
import { Rule, CommitInfo, DiffFile } from '@/types';

const awsRule: Rule = {
  id: '1',
  name: 'AWS Access Key ID',
  pattern: 'AKIA[0-9A-Z]{16}',
  severity: 'high',
  description: 'aws',
};

describe('scanContent', () => {
  it('reports a match with 1-based line number, repo, file and rule name', () => {
    const content = 'line one\nkey = AKIAIOSFODNN7EXAMPLE\nline three';
    const results = scanContent(content, [awsRule], 'my-repo', 'config.txt');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      repo: 'my-repo',
      file: 'config.txt',
      ruleId: 'AWS Access Key ID', // ruleId carries the rule *name*
      line: 2,
    });
  });

  it('does not append an ellipsis when the matched line is short (bug fix)', () => {
    const results = scanContent('AKIAIOSFODNN7EXAMPLE', [awsRule], 'r', 'f');
    expect(results[0].match).toBe('AKIAIOSFODNN7EXAMPLE');
    expect(results[0].match.endsWith('...')).toBe(false);
  });

  it('truncates and appends an ellipsis only when the line exceeds 50 chars', () => {
    const long = 'AKIAIOSFODNN7EXAMPLE ' + 'x'.repeat(60);
    const results = scanContent(long, [awsRule], 'r', 'f');
    expect(results[0].match).toHaveLength(53); // 50 chars + '...'
    expect(results[0].match.endsWith('...')).toBe(true);
  });

  it('honours PCRE-style (?i) inline case-insensitive flags (bug fix)', () => {
    const rule: Rule = { ...awsRule, name: 'ci', pattern: '(?i)secret' };
    const results = scanContent('My SECRET value', [rule], 'r', 'f');
    expect(results).toHaveLength(1);
  });

  it('matches the same rule on consecutive lines (global-regex lastIndex reset)', () => {
    const content = 'AKIAIOSFODNN7EXAMPLE\nAKIAIOSFODNN7EXAMPLE';
    const results = scanContent(content, [awsRule], 'r', 'f');
    expect(results.map(r => r.line)).toEqual([1, 2]);
  });

  it('swallows an invalid regex pattern instead of throwing', () => {
    const bad: Rule = { ...awsRule, name: 'bad', pattern: '([unterminated' };
    expect(() => scanContent('anything', [bad], 'r', 'f')).not.toThrow();
    expect(scanContent('anything', [bad], 'r', 'f')).toEqual([]);
  });

  it('returns no results when nothing matches', () => {
    expect(scanContent('clean content', [awsRule], 'r', 'f')).toEqual([]);
  });
});

describe('extractAddedLines', () => {
  it('numbers added lines from the hunk header and skips removed/context lines', () => {
    const patch = [
      '@@ -1,2 +1,3 @@',
      ' context',
      '-removed',
      '+added one',
      '+added two',
    ].join('\n');

    expect(extractAddedLines(patch)).toEqual([
      { line: 2, text: 'added one' },
      { line: 3, text: 'added two' },
    ]);
  });

  it('ignores "\\ No newline at end of file" markers so line numbers stay correct (bug fix)', () => {
    const patch = [
      '@@ -1 +1,2 @@',
      '-old',
      '\\ No newline at end of file',
      '+new line one',
      '+new line two',
    ].join('\n');

    expect(extractAddedLines(patch)).toEqual([
      { line: 1, text: 'new line one' },
      { line: 2, text: 'new line two' },
    ]);
  });

  it('does not treat the +++ header as an added line', () => {
    const patch = [
      'diff --git a/f b/f',
      '--- a/f',
      '+++ b/f',
      '@@ -0,0 +1 @@',
      '+only line',
    ].join('\n');

    expect(extractAddedLines(patch)).toEqual([{ line: 1, text: 'only line' }]);
  });
});

describe('scanDiff', () => {
  const commit: CommitInfo = {
    sha: 'abc123',
    message: 'add secret',
    author: 'Dev',
    date: '2026-01-01T00:00:00Z',
  };

  it('scans added lines only and attaches commit metadata', () => {
    const diff: DiffFile[] = [
      {
        filename: 'secrets.env',
        patch: ['@@ -0,0 +1,2 @@', '+AKIAIOSFODNN7EXAMPLE', '+harmless'].join('\n'),
      },
    ];
    const results = scanDiff(diff, [awsRule], 'repo', commit);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      repo: 'repo',
      file: 'secrets.env',
      line: 1,
      commitSha: 'abc123',
      commitAuthor: 'Dev',
      commitMessage: 'add secret',
    });
  });

  it('ignores files without a patch', () => {
    const diff: DiffFile[] = [{ filename: 'bin', patch: '' }];
    expect(scanDiff(diff, [awsRule], 'repo', commit)).toEqual([]);
  });

  it('does not match secrets that only appear in removed lines', () => {
    const diff: DiffFile[] = [
      { filename: 'f', patch: ['@@ -1 +0,0 @@', '-AKIAIOSFODNN7EXAMPLE'].join('\n') },
    ];
    expect(scanDiff(diff, [awsRule], 'repo', commit)).toEqual([]);
  });
});
