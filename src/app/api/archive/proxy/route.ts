import { NextRequest, NextResponse } from 'next/server';
import { proxyFetch } from '@/lib/security/ssrf';
import { limitBytes } from '@/lib/security/stream';

// Upper bound on how much archive data the proxy will relay for one request.
// The URL is caller-supplied, so without a cap this endpoint could be made to
// buffer/relay arbitrarily large responses.
const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024; // 100 MiB

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

  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_ARCHIVE_BYTES) {
    return NextResponse.json(
      { error: `Archive too large (limit ${MAX_ARCHIVE_BYTES} bytes)` },
      { status: 413 }
    );
  }

  // Stream the zip through instead of buffering it in server memory, and
  // enforce the size cap even when the upstream sends no Content-Length.
  const body = response.body ? limitBytes(response.body, MAX_ARCHIVE_BYTES) : null;
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="archive.zip"',
      // The response may be token-authorized; never let it be cached.
      'Cache-Control': 'no-store',
    },
  });
}
