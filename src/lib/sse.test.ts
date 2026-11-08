import { describe, expect, it } from "vitest";
import { readSse, splitSse } from "@/lib/sse";

describe("splitSse", () => {
  it("parses complete messages and keeps the partial tail", () => {
    const { messages, rest } = splitSse('event: start\ndata: {"job":"a","step":"qa"}\n\nevent: step\ndata: {"st');
    expect(messages).toEqual([{ event: "start", data: { job: "a", step: "qa" } }]);
    expect(rest).toBe('event: step\ndata: {"st');
  });

  it("handles CRLF, comments, multi-line data and a missing event name", () => {
    const { messages } = splitSse(": keepalive\r\n\r\ndata: one\r\ndata: two\r\n\r\n");
    expect(messages).toEqual([{ event: "message", data: "one\ntwo" }]);
  });
});

describe("readSse", () => {
  it("reassembles messages split across chunks", async () => {
    const enc = new TextEncoder();
    const chunks = ["event: comm", 'and\ndata: {"index":1}\n', "\nevent: done\ndata: {}\n\n"];
    const body = new ReadableStream({
      start(c) {
        for (const ch of chunks) c.enqueue(enc.encode(ch));
        c.close();
      },
    });
    const out = [];
    for await (const m of readSse(new Response(body))) out.push(m);
    expect(out).toEqual([
      { event: "command", data: { index: 1 } },
      { event: "done", data: {} },
    ]);
  });
});
