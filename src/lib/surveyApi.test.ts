// The live client's guards: read paths refuse job ids and kinds that URL normalisation would rewrite,
// and a cancelled step stays an AbortError rather than looking like a dead server.
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getJob, getRasterView, getVectorView, productUrl, runStep } from "@/lib/surveyApi";

const fetched: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  fetched.length = 0;
});

function stubFetch(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal("fetch", (input: string, init?: RequestInit) => {
    fetched.push(String(input));
    return handler(String(input), init);
  });
}

describe("read paths", () => {
  it("refuse '.' and '..' and other unsafe ids before the wire", async () => {
    stubFetch(async () => new Response("{}", { status: 200 }));
    for (const bad of ["..", ".", "a/b", ""]) {
      await expect(getJob(bad), bad).rejects.toBeInstanceOf(ApiError);
      await expect(getRasterView(bad, "hillshade"), bad).rejects.toBeInstanceOf(ApiError);
      await expect(getVectorView(bad, "boundary"), bad).rejects.toBeInstanceOf(ApiError);
      expect(productUrl(bad, "report"), bad).toBe("");
    }
    await expect(getVectorView("job-1", "..")).rejects.toBeInstanceOf(ApiError);
    expect(productUrl("job-1", "..")).toBe("");
    expect(fetched).toEqual([]);
  });

  it("still address a safe job", async () => {
    stubFetch(async () => new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), { status: 200 }));
    expect(productUrl("job-1", "report")).toMatch(/\/jobs\/job-1\/report$/);
    await getVectorView("job-1", "boundary");
    expect(fetched.at(-1)).toMatch(/\/jobs\/job-1\/web\/boundary$/);
  });
});

describe("runStep", () => {
  it("hands back a cancel as an AbortError, not 'cannot reach argus-survey'", async () => {
    stubFetch(async (url, init) => {
      if (url.endsWith("/health")) return new Response(JSON.stringify({ read_only: false }), { status: 200 });
      const signal = init?.signal;
      return new Promise<Response>((_, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    });
    const ctl = new AbortController();
    const run = runStep("job-1", "qa", {}, () => {}, ctl.signal);
    await new Promise((r) => setTimeout(r, 0));
    ctl.abort();
    const err = await run.catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(ApiError);
    expect((err as Error).name).toBe("AbortError");
  });

  it("still reports a network failure as ApiError", async () => {
    stubFetch(async (url) => {
      if (url.endsWith("/health")) return new Response(JSON.stringify({ read_only: false }), { status: 200 });
      throw new TypeError("Failed to fetch");
    });
    await expect(runStep("job-1", "qa", {}, () => {})).rejects.toBeInstanceOf(ApiError);
  });
});
