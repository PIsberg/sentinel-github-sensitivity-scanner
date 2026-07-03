import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { scanContent, scanDiff, extractAddedLines, extractFilesFromZip } from './scanner';
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
    const content = 'line one\nkey = AKIAIOSFODNN7ABCD123\nline three';
    const results = scanContent(content, [awsRule], 'my-repo', 'config.txt');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      repo: 'my-repo',
      file: 'config.txt',
      ruleId: 'AWS Access Key ID', // ruleId carries the rule *name*
      severity: 'high',
      line: 2,
    });
  });

  it('carries the rule severity into each result', () => {
    const medium: Rule = { ...awsRule, severity: 'medium' };
    const results = scanContent('AKIAIOSFODNN7ABCD123', [medium], 'r', 'f');
    expect(results[0].severity).toBe('medium');
  });

  it('does not append an ellipsis when the matched line is short (bug fix)', () => {
    const results = scanContent('AKIAIOSFODNN7ABCD123', [awsRule], 'r', 'f');
    expect(results[0].match).toBe('AKIAIOSFODNN7ABCD123');
    expect(results[0].match.endsWith('...')).toBe(false);
  });

  it('truncates and appends an ellipsis only when the line exceeds 50 chars', () => {
    const long = 'AKIAIOSFODNN7ABCD123 ' + 'a'.repeat(60);
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
    const content = 'AKIAIOSFODNN7ABCD123\nAKIAIOSFODNN7ABCD123';
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

describe('extractFilesFromZip', () => {
  async function makeZip(entries: Record<string, string | Uint8Array>): Promise<ArrayBuffer> {
    const zip = new JSZip();
    for (const [path, content] of Object.entries(entries)) {
      zip.file(path, content);
    }
    return zip.generateAsync({ type: 'arraybuffer' });
  }

  it('extracts text files with their content', async () => {
    const data = await makeZip({ 'repo/config.env': 'API_KEY=abc' });
    const files = await extractFilesFromZip(data);
    expect(files).toEqual([{ path: 'repo/config.env', content: 'API_KEY=abc' }]);
  });

  it('skips files with binary extensions', async () => {
    const data = await makeZip({ 'a.png': 'x', 'b.jar': 'x', 'c.mp4': 'x', 'keep.txt': 'x' });
    const files = await extractFilesFromZip(data);
    expect(files.map(f => f.path)).toEqual(['keep.txt']);
  });

  it('skips extension-less binary files by sniffing for null bytes', async () => {
    const binary = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x00, 0x01, 0x02]);
    const data = await makeZip({ 'somebinary': binary, 'readme': 'text' });
    const files = await extractFilesFromZip(data);
    expect(files.map(f => f.path)).toEqual(['readme']);
  });

  it('skips files larger than the size cap', async () => {
    const data = await makeZip({ 'huge.txt': 'a'.repeat(100), 'small.txt': 'ok' });
    const files = await extractFilesFromZip(data, 50);
    expect(files.map(f => f.path)).toEqual(['small.txt']);
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
        patch: ['@@ -0,0 +1,2 @@', '+AKIAIOSFODNN7ABCD123', '+harmless'].join('\n'),
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
      { filename: 'f', patch: ['@@ -1 +0,0 @@', '-AKIAIOSFODNN7ABCD123'].join('\n') },
    ];
    expect(scanDiff(diff, [awsRule], 'repo', commit)).toEqual([]);
  });
});

describe('placeholder allowlist', () => {
  it('suppresses documented example/placeholder secrets', () => {
    for (const fake of [
      'AKIAIOSFODNN7EXAMPLE', // AWS docs placeholder
      'AKIAXXXXXXXXXXXXXXXX',
      'AKIA000000000000DEAD',
    ]) {
      expect(scanContent(fake, [awsRule], 'r', 'f'), fake).toEqual([]);
    }
  });

  it('suppresses YOUR_API_KEY-style placeholders', () => {
    const rule: Rule = { ...awsRule, name: 'generic', pattern: 'token=\\S+' };
    expect(scanContent('token=YOUR_API_TOKEN', [rule], 'r', 'f')).toEqual([]);
  });

  it('still reports a real secret on a line that merely mentions "example"', () => {
    // The word "example" is in a comment, not in the matched key itself.
    const content = '# example config\nkey = AKIAIOSFODNN7ABCD123';
    const results = scanContent(content, [awsRule], 'r', 'f');
    expect(results).toHaveLength(1);
    expect(results[0].line).toBe(2);
  });
});

describe('new rule patterns', () => {
  const cases: Array<{ name: string; pattern: string; hit: string; miss: string }> = [
    {
      name: 'GitHub ghu_ token',
      pattern: 'gh[oprstu]_[a-zA-Z0-9]{36}',
      hit: 'ghu_' + 'a'.repeat(36),
      miss: 'ghz_' + 'a'.repeat(36),
    },
    {
      name: 'Stripe restricted key',
      pattern: 'rk_(?:live|test)_[0-9a-zA-Z]{24,}',
      hit: 'rk_live_' + 'A1b2C3d4E5f6G7h8I9j0K1l2',
      miss: 'rk_prod_' + 'A1b2C3d4E5f6G7h8I9j0K1l2',
    },
    {
      name: 'Database connection string',
      pattern: '(?:mongodb(?:\\+srv)?|postgres(?:ql)?|mysql|redis|amqp)://[^:@\\s/]+:[^@\\s/]+@',
      hit: 'postgres://admin:s3cr3tpw@db.internal:5432/app',
      miss: 'postgres://db.internal:5432/app',
    },
    {
      name: 'Generic api_key assignment (case-insensitive)',
      pattern: '(?i)(?:api[_-]?key|secret|token)\\s*[=:]\\s*[\'"]?[a-zA-Z0-9/+_-]{20,}',
      hit: 'API_KEY = "aZ09bY18cX27dW36eV45"',
      miss: 'api_key = "short"',
    },
  ];

  for (const c of cases) {
    it(`matches a ${c.name} and ignores a near-miss`, () => {
      const rule: Rule = { id: 'x', name: c.name, pattern: c.pattern, severity: 'high', description: '' };
      expect(scanContent(c.hit, [rule], 'r', 'f'), `hit: ${c.hit}`).toHaveLength(1);
      expect(scanContent(c.miss, [rule], 'r', 'f'), `miss: ${c.miss}`).toEqual([]);
    });
  }
});
