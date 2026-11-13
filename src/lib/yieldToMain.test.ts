import { afterEach, describe, expect, it, vi } from "vitest";
import { yieldToMain } from "./yieldToMain";

describe("yieldToMain", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses scheduler.yield where it exists", async () => {
    const y = vi.fn(() => Promise.resolve());
    vi.stubGlobal("scheduler", { yield: y });
    await yieldToMain();
    expect(y).toHaveBeenCalledOnce();
  });

  it("falls back to a macrotask without it (Safari)", async () => {
    vi.stubGlobal("scheduler", undefined);
    const order: string[] = [];
    setTimeout(() => order.push("earlier task"), 0);
    await yieldToMain();
    order.push("resumed");
    expect(order).toEqual(["earlier task", "resumed"]);
  });
});
