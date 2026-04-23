export function cleanToken(token?: string): string {
  if (!token?.trim()) return '';
  let t = token.trim();
  if (t.toLowerCase().startsWith('bearer ')) t = t.substring(7).trim();
  else if (t.toLowerCase().startsWith('token ')) t = t.substring(6).trim();
  return t;
}
