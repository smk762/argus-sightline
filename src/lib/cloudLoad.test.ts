import { describe, expect, it } from "vitest";
import { cloudAction } from "@/lib/cloudLoad";

describe("cloudAction", () => {
  it("loads a cloud when first shown, and again for a new cloud or budget", () => {
    expect(cloudAction(null, true, "abc", 2e6)).toEqual({ action: "load", key: "abc:2000000" });
    expect(cloudAction("abc:2000000", true, "abc", 2e6)).toEqual({ action: "keep", key: "abc:2000000" });
    expect(cloudAction("abc:2000000", true, "def", 2e6)).toEqual({ action: "load", key: "def:2000000" });
    expect(cloudAction("abc:2000000", true, "abc", 4e6)).toEqual({ action: "load", key: "abc:4000000" });
  });

  it("waits until the view is shown", () => {
    expect(cloudAction(null, false, "abc", 2e6)).toEqual({ action: "keep", key: null });
  });

  // Audit pack-argus-sightline-4431090ea7: a job with no streamable cloud must not keep the last job's on screen.
  it("clears the cloud on screen when the job has none, shown or not", () => {
    expect(cloudAction("abc:2000000", true, null, 2e6)).toEqual({ action: "clear", key: null });
    expect(cloudAction("abc:2000000", false, null, 2e6)).toEqual({ action: "clear", key: null });
    expect(cloudAction(null, true, null, 2e6)).toEqual({ action: "keep", key: null });
  });
});
