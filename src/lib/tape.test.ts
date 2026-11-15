import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { eventsFor, parseTape, recordedSteps, replaySchedule, tapePath, type Tape } from "@/lib/tape";

const tape = parseTape(JSON.parse(readFileSync(new URL("../../public/data-tape/tape.json", import.meta.url), "utf8")));

describe("the committed tape", () => {
  it("is one recorded job, at the survey commit this UI is synced to", () => {
    const pins = JSON.parse(readFileSync(new URL("../../schema/pins.json", import.meta.url), "utf8"));
    expect(tape.survey.commit).toBe(pins.survey.tag);
    expect(tape.survey.version).toBe(pins.survey.version);
    expect(Object.keys(tape.views)).toEqual([tape.job]);
  });

  it("can replay every core step and the measures it ran, and nothing it didn't", () => {
    const steps = recordedSteps(tape, tape.job);
    for (const s of ["ingest", "qa", "ground", "surfaces", "contours", "volume", "profile", "report"]) expect(steps.has(s), s).toBe(true);
    for (const s of ["cutfill", "change", "accuracy"]) expect(steps.has(s), s).toBe(false);
  });
});

describe("eventsFor", () => {
  it("gives a step its own run when it has one", () => {
    const events = eventsFor(tape, tape.job, "volume")!;
    expect(events.at(-1)!.event).toBe("done");
    expect((events.at(-1)!.data as { step: string }).step).toBe("volume");
  });

  it("slices a core step out of the pipeline run and closes it with a done", () => {
    const events = eventsFor(tape, tape.job, "ground")!;
    expect(events[0]).toMatchObject({ t: 0, event: "start" });
    expect(events[1]).toMatchObject({ event: "step", data: { step: "ground", state: "start" } });
    expect(events.at(-2)).toMatchObject({ event: "step", data: { step: "ground", state: "done" } });
    expect(events.at(-1)).toMatchObject({ event: "done", data: { step: "ground" } });
    expect(events.filter((e) => e.event === "command").every((e) => (e.data as { step: string }).step === "ground")).toBe(true);
  });

  it("has nothing for a step or job the recording lacks", () => {
    expect(eventsFor(tape, tape.job, "accuracy")).toBeNull();
    expect(eventsFor(tape, "another-job", "volume")).toBeNull();
  });
});

describe("replaySchedule", () => {
  it("keeps the order and caps each gap", () => {
    const at = replaySchedule([{ t: 0 }, { t: 100 }, { t: 30_000 }, { t: 30_050 }] as Tape["runs"][number]["events"], 350);
    expect(at).toEqual([0, 100, 450, 500]);
  });
});

describe("parseTape and tapePath", () => {
  it("rejects what is not a tape", () => {
    expect(() => parseTape({})).toThrow();
    expect(() => parseTape({ ...tape, runs: [{ job: "x", step: "qa", body: {}, events: [{ t: 0, event: "eval", data: 1 }] }] })).toThrow();
  });

  it("keeps paths inside the tape", () => {
    expect(tapePath("jobs/a/web/x.png")).toBe("jobs/a/web/x.png");
    for (const bad of ["../x", "a/../../x", "https://example.com/x", "//example.com/x"]) expect(() => tapePath(bad), bad).toThrow();
  });
});
