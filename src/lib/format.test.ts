import { describe, expect, it } from "vitest";
import { count, m3, num, seconds } from "@/lib/format";

describe("num", () => {
  it("groups thousands with a thin space, not a comma", () => {
    expect(m3(12345.64)).toBe("12 345.6 m³");
    expect(count(1234567)).toBe("1 234 567");
    expect(num(-9876.5, 1)).toBe("-9 876.5");
    expect(num(999.999, 2)).toBe("1 000.00");
    expect(num(NaN)).toBe("—");
  });
});

describe("seconds", () => {
  it("never shows 1000 ms", () => {
    expect(seconds(0.25)).toBe("250 ms");
    expect(seconds(0.9994)).toBe("999 ms");
    expect(seconds(0.9995)).toBe("1.0 s");
    expect(seconds(0.9999)).toBe("1.0 s");
    expect(seconds(75)).toBe("1 min 15 s");
  });
});

