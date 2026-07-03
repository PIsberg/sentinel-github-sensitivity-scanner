/**
 * Wraps a byte stream so it errors once more than `maxBytes` have passed
 * through. Used by the archive proxy to bound how much data a caller-supplied
 * URL can make the server relay, instead of buffering an unbounded body.
 */
export function limitBytes(
  source: ReadableStream<Uint8Array>,
  maxBytes: number
): ReadableStream<Uint8Array> {
  let total = 0;
  return source.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength;
        if (total > maxBytes) {
          controller.error(new Error(`Response exceeded ${maxBytes} byte limit`));
          return;
        }
        controller.enqueue(chunk);
      },
    })
  );
}
