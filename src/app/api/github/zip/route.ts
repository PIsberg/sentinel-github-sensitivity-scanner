
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const ref = searchParams.get('ref');

    if (!owner || !repo || !ref) {
        return NextResponse.json({ error: 'Missing owner, repo, or ref' }, { status: 400 });
    }

    const token = request.headers.get('Authorization');
    const headers: HeadersInit = {};
    if (token) {
        headers['Authorization'] = token;
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/zipball/${ref}`;

    try {
        console.log(`[API] Proxying zip download for ${owner}/${repo} @ ${ref}`);
        const response = await fetch(url, {
            headers: headers,
            method: 'GET',
            redirect: 'follow'
        });

        if (!response.ok) {
            console.error(`[API] GitHub responded with ${response.status}`);
            const text = await response.text();
            return NextResponse.json({ error: `GitHub API error: ${response.status} - ${text}` }, { status: response.status });
        }

        // Return the array buffer directly
        const arrayBuffer = await response.arrayBuffer();

        return new NextResponse(arrayBuffer, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${repo}-${ref}.zip"`
            }
        });

    } catch (error: any) {
        console.error('[API] Proxy error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
