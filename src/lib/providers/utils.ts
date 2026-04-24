import { DiffFile } from '@/types';

export function cleanToken(token?: string): string {
  if (!token?.trim()) return '';
  let t = token.trim();
  if (t.toLowerCase().startsWith('bearer ')) t = t.substring(7).trim();
  else if (t.toLowerCase().startsWith('token ')) t = t.substring(6).trim();
  return t;
}

export function parseUnifiedDiff(rawDiff: string): DiffFile[] {
  const sections = rawDiff.split(/(?=^diff --git )/m).filter(Boolean);
  return sections.map(section => {
    const plusLine = section.match(/^\+\+\+ b\/(.+)$/m);
    const filename = plusLine ? plusLine[1] : 'unknown';
    return { filename, patch: section };
  });
}
