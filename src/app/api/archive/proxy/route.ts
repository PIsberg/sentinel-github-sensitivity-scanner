import { NextRequest, NextResponse } from 'next/server';
import { proxyFetch } from '@/lib/security/ssrf';

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url');
  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  const authHeader = request.headers.get('Authorization');

  let result;
  try {
    // proxyFetch enforces HTTPS, blocks private/internal targets, validates
    // every redirect hop, and drops the Authorization header cross-origin.
    result = await proxyFetch({ url: rawUrl, authHeader });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!result.ok || !result.response) {
    return NextResponse.json(
      { error: result.error ?? 'Proxy error' },
      { status: result.status ?? 500 }
    );
  }

  const response = result.response;
  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json(
      { error: `Upstream error: ${response.status} - ${text}` },
      { status: response.status }
    );
  }

  const buffer = await response.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="archive.zip"',
    },
  });
}
