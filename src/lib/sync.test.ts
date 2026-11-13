/**
 * The offline sync check (argus-sightline#7): the wire pin, the recorded demo
 * numbers, the README and any imported docs all describe the same argus-survey
 * commit. Fails `make check` when they drift apart; `make demo-record` and
 * `npm run wire:pull` put them back together. The scheduled drift check
 * (.github/workflows/survey-drift.yml) keeps that commit at survey's `dev` HEAD.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_END, DEMO_START, demoTable } from "../../scripts/demo-table.mjs";
import { KIT_TRUTH, TRUTH_TOLERANCE } from "@/lib/demoKit";

const root = join(__dirname, "..", "..");
const read = (path: string): string => readFileSync(join(root, path), "utf8");

interface DemoRecord {
  survey: { commit: string; version: string };
  checks: { id: keyof typeof TRUTH_TOLERANCE; label: string; unit: string; truth: number; measured: number }[];
}

const pin = JSON.parse(read("schema/pins.json")).survey as {
  tag: string;
  version: string;
  docs?: Record<string, string>;
};
const record = JSON.parse(read("schema/demo-record.json")) as DemoRecord;

describe("survey sync record", () => {
  it("pins a full commit sha, not a tag or a local pin", () => {
    expect(pin.tag).toMatch(/^[0-9a-f]{40}$/);
  });

  it("matches the recorded demo data's commit and version", () => {
    expect(record.survey.commit).toBe(pin.tag);
    expect(record.survey.version).toBe(pin.version);
  });

  it("matches the README's demo table", () => {
    const readme = read("README.md");
    const start = readme.indexOf(DEMO_START);
    const end = readme.indexOf(DEMO_END);
    expect(start, "README.md lost its demo-record markers").toBeGreaterThanOrEqual(0);
    expect(readme.slice(start, end + DEMO_END.length)).toBe(demoTable(record));
  });

  it("records the truths the guided demo shows, within its tolerances", () => {
    const truths: Record<string, number> = {
      "stockpile-e1": KIT_TRUTH.stockpileVolume,
      "stockpile-e2": KIT_TRUTH.stockpileVolumeE2,
      "pad-net-cut": KIT_TRUTH.padNetCut,
      "change-gain": KIT_TRUTH.changeGain,
    };
    expect(record.checks.map((c) => c.id).sort()).toEqual(Object.keys(truths).sort());
    for (const c of record.checks) {
      expect(c.truth, c.id).toBeCloseTo(truths[c.id], 1);
      expect(Math.abs((c.measured - c.truth) / c.truth) * 100, c.id).toBeLessThanOrEqual(TRUTH_TOLERANCE[c.id]);
    }
  });

  it("has imported docs that match their recorded hashes", () => {
    for (const [file, sha] of Object.entries(pin.docs ?? {})) {
      expect(createHash("sha256").update(read(join("docs", "survey", file))).digest("hex"), file).toBe(sha);
    }
  });
});
