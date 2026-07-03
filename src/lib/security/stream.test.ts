import { describe, it, expect } from 'vitest';
import { limitBytes } from './stream';

function streamOf(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<number> {
  const reader = stream.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return total;
    total += value.byteLength;
  }
}

describe('limitBytes', () => {
  it('passes a stream through untouched when under the limit', async () => {
    const stream = limitBytes(streamOf(new Uint8Array(10), new Uint8Array(5)), 100);
    expect(await drain(stream)).toBe(15);
  });

  it('allows a stream that is exactly at the limit', async () => {
    const stream = limitBytes(streamOf(new Uint8Array(10)), 10);
    expect(await drain(stream)).toBe(10);
  });

  it('errors once the cumulative size exceeds the limit', async () => {
    const stream = limitBytes(streamOf(new Uint8Array(10), new Uint8Array(10)), 15);
    await expect(drain(stream)).rejects.toThrow(/byte limit/);
  });
});
