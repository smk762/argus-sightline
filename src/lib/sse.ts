/**
 * Server-Sent Events over a POST response. `EventSource` only does GET, and every
 * argus-survey step is a POST, so the stream is parsed here from `fetch`'s body.
 */

export interface SseMessage {
  event: string;
  data: unknown;
}

/**
 * Split complete messages off the front of `buffer`. Pure: returns the parsed
 * messages and the unconsumed tail (a partial message waiting for more bytes).
 * Handles `\r\n` line endings, multi-line `data:` fields and `:` comments; a
 * message without `event:` is a `message`, per the SSE spec.
 */
export function splitSse(buffer: string): { messages: SseMessage[]; rest: string } {
  // A trailing `\r` may be the first half of a `\r\n` split across chunks: keep it raw for the next call,
  // or it and the next chunk's `\n` would each become a newline and end the message early.
  const held = buffer.endsWith("\r") ? "\r" : "";
  const text = buffer.slice(0, buffer.length - held.length).replace(/\r\n?/g, "\n");
  const messages: SseMessage[] = [];
  let start = 0;
  for (let end = text.indexOf("\n\n", start); end >= 0; end = text.indexOf("\n\n", start)) {
    const block = text.slice(start, end);
    start = end + 2;
    let event = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (line === "" || line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon < 0 ? line : line.slice(0, colon);
      const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
      if (field === "event") event = value;
      else if (field === "data") data.push(value);
    }
    if (data.length === 0) continue;
    const raw = data.join("\n");
    let parsed: unknown = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // not JSON: hand over the text
    }
    messages.push({ event, data: parsed });
  }
  return { messages, rest: text.slice(start) + held };
}

/** Every message of a streaming response, in order. */
export async function* readSse(response: Response): AsyncGenerator<SseMessage> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { messages, rest } = splitSse(buffer);
      buffer = rest;
      yield* messages;
    }
    const { messages } = splitSse(buffer + decoder.decode() + "\n\n");
    yield* messages;
  } finally {
    reader.releaseLock();
  }
}
