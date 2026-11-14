import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import pins from "../../schema/pins.json";
import {
  DOC_PAGES,
  docsUrl,
  fileUrl,
  githubAnchor,
  resolveDocImage,
  resolveDocLink,
  SECTIONS,
  shortSha,
  sourceUrl,
  SURVEY,
  type DocsTopic,
} from "@/lib/surveyDocs";
import { docTitle, renderSurveyDoc } from "@/lib/surveyMarkdown";

const imported = pins.survey.docs as Record<string, string>;
const read = (file: string) => readFileSync(join(__dirname, "..", "..", "docs", "survey", file), "utf8");

/** Heading anchors in a markdown file, outside code fences, as survey's tests/test_docs.py finds them. */
function anchors(markdown: string): Set<string> {
  const out = new Set<string>();
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (line.startsWith("```")) fenced = !fenced;
    else if (!fenced && line.startsWith("#")) out.add(githubAnchor(line.replace(/^#+/, "")));
  }
  return out;
}

describe("surveyDocs", () => {
  it("names survey's source at the pinned commit, never a branch", () => {
    expect(SURVEY.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(sourceUrl()).toBe(`https://github.com/smk762/argus-survey/tree/${SURVEY.commit}`);
    expect(shortSha(SURVEY.commit)).toHaveLength(7);
  });

  it("sends each topic to its reference section in the imported docs (argus-sightline#23)", () => {
    expect(docsUrl("datum")).toBe("/docs/survey/datums#no-silent-datums-rule-1");
    expect(docsUrl("datum-fault")).toBe("/docs/survey/datums#why-red");
    expect(docsUrl("truth")).toBe("/docs/survey/data-sources#demo-kit");
    expect(docsUrl("volume")).toBe("/docs/survey/steps#volume");
    expect(docsUrl("cutfill")).toBe("/docs/survey/steps#cutfill");
    expect(docsUrl("volume-bases")).toBe("/docs/survey/methods#volume-bases");
    expect(docsUrl("accuracy-method")).toBe("/docs/survey/methods#vertical-accuracy-nva-and-vva");
    expect(docsUrl("provenance")).toBe("/docs/survey/provenance#what-jobjson-records");
    expect(docsUrl("refusals")).toBe("/docs/survey/runbook#reading-refusals");
  });

  it("links only to headings that exist in the imported docs", () => {
    for (const [topic, [file, anchor]] of Object.entries(SECTIONS) as [DocsTopic, readonly [string, string]][]) {
      expect(imported, `${topic}: ${file} is not imported`).toHaveProperty([file]);
      expect(anchors(read(file)), `${topic}: ${file}#${anchor}`).toContain(anchor);
      expect(renderSurveyDoc(read(file), file), `${topic}: rendered id`).toContain(`id="${anchor}"`);
    }
  });

  it("has a page for every imported markdown file and imports every page", () => {
    const md = Object.keys(imported).filter((f) => f.endsWith(".md")).sort();
    expect(DOC_PAGES.map((p) => p.file).sort()).toEqual(md);
  });

  it("falls back to GitHub at the pinned commit for a file that is not imported", () => {
    expect(fileUrl("CLAUDE.md", "x")).toBe(`https://github.com/smk762/argus-survey/blob/${SURVEY.commit}/CLAUDE.md#x`);
  });
});

describe("resolveDocLink", () => {
  it("keeps links between imported files in the docs", () => {
    expect(resolveDocLink("datums.md#why-red", "docs/methods.md")).toEqual({ href: "/docs/survey/datums#why-red", external: false });
    expect(resolveDocLink("../README.md#commands", "docs/methods.md")).toEqual({ href: "/docs/survey#commands", external: false });
    expect(resolveDocLink("docs/steps.md", "README.md")).toEqual({ href: "/docs/survey/steps", external: false });
    expect(resolveDocLink("#volume-bases", "docs/methods.md")).toEqual({ href: "#volume-bases", external: false });
  });

  it("maps survey's own GitHub URLs on any branch to the pinned docs", () => {
    expect(resolveDocLink("https://github.com/smk762/argus-survey/blob/main/docs/methods.md#volume-bases", "README.md")).toEqual({
      href: "/docs/survey/methods#volume-bases",
      external: false,
    });
  });

  it("pins survey's GitHub URLs for files that are not imported to the synced commit", () => {
    expect(resolveDocLink("https://github.com/smk762/argus-survey/blob/main/env/geo.yml#L3", "README.md")).toEqual({
      href: `https://github.com/smk762/argus-survey/blob/${SURVEY.commit}/env/geo.yml#L3`,
      external: true,
    });
  });

  it("reads a leading slash as the repo root and keeps every # after the first in the anchor", () => {
    expect(resolveDocLink("/docs/steps.md#volume", "docs/methods.md")).toEqual({ href: "/docs/survey/steps#volume", external: false });
    expect(resolveDocLink("steps.md#a#b", "docs/methods.md")).toEqual({ href: "/docs/survey/steps#a#b", external: false });
  });

  it("sends the rest off-site in a new tab, at the pinned commit for survey's other files", () => {
    expect(resolveDocLink("https://www.ahn.nl/", "docs/data-sources.md")).toEqual({ href: "https://www.ahn.nl/", external: true });
    expect(resolveDocLink("../env/geo.yml", "docs/runbook.md")).toEqual({
      href: `https://github.com/smk762/argus-survey/blob/${SURVEY.commit}/env/geo.yml`,
      external: true,
    });
  });

  it("drops scripts and paths that climb out of the repo", () => {
    expect(resolveDocLink("javascript:alert(1)", "README.md")).toBeNull();
    expect(resolveDocLink("data:text/html,x", "README.md")).toBeNull();
    expect(resolveDocLink("../../etc/passwd", "README.md")).toBeNull();
  });

  it("resolves every link in the imported docs", () => {
    for (const { file } of DOC_PAGES) {
      for (const m of read(file).matchAll(/\]\(([^)\s]+)/g)) {
        expect(resolveDocLink(m[1], file), `${file}: ${m[1]}`).not.toBeNull();
      }
    }
  });
});

describe("resolveDocImage", () => {
  it("serves imported images from this origin and nothing else", () => {
    expect(resolveDocImage("https://raw.githubusercontent.com/smk762/argus-survey/main/docs/img/viewer.png", "README.md")).toBe(
      "/docs/survey/img/viewer.png",
    );
    expect(resolveDocImage("img/viewer.png", "docs/methods.md")).toBe("/docs/survey/img/viewer.png");
    expect(resolveDocImage("https://example.com/x.png", "README.md")).toBeNull();
    expect(resolveDocImage("img/missing.png", "docs/methods.md")).toBeNull();
  });
});

describe("renderSurveyDoc", () => {
  it("gives headings GitHub's anchors, numbering repeats", () => {
    const html = renderSurveyDoc("# A\n\n## What `job.json` records\n\n## Notes\n\n## Notes\n", "docs/x.md");
    expect(html).toContain('<h2 id="what-jobjson-records">What <code>job.json</code> records</h2>');
    expect(html).toContain('<h2 id="notes">');
    expect(html).toContain('<h2 id="notes-1">');
    expect(renderSurveyDoc("## See [Datums](datums.md)\n", "docs/x.md")).toContain('<h2 id="see-datums">');
  });

  it("drops raw HTML and unsafe links, keeping their text", () => {
    const html = renderSurveyDoc('<script>alert(1)</script>\n\nA <b onclick="x">b</b> [c](javascript:alert(1))\n', "README.md");
    expect(html).toBe("<p>A b c</p>\n");
  });

  it("heads a doc that has no title of its own", () => {
    expect(renderSurveyDoc("text\n", "README.md", "argus-survey")).toBe("<h1>argus-survey</h1>\n<p>text</p>\n");
    expect(renderSurveyDoc("# Own\n", "docs/x.md", "argus-survey")).not.toContain("argus-survey");
  });

  it("opens off-site links in a new tab and keeps docs links in place", () => {
    const html = renderSurveyDoc("[out](https://www.ahn.nl/) [in](datums.md#why-red)\n", "docs/methods.md");
    expect(html).toContain('<a href="https://www.ahn.nl/" target="_blank" rel="noopener noreferrer">out');
    expect(html).toContain('<a href="/docs/survey/datums#why-red">in</a>');
  });

  it("puts tables in their own scroll box and serves images locally", () => {
    const html = renderSurveyDoc(read("README.md"), "README.md");
    expect(html).toContain('<div class="doc-table"><table>');
    expect(html).toContain('src="/docs/survey/img/viewer.png"');
    expect(html).not.toContain("raw.githubusercontent.com");
  });

  it("titles a page by its first heading", () => {
    expect(docTitle(read("docs/methods.md"), "x")).toBe("Methods");
    expect(docTitle("no heading", "fallback")).toBe("fallback");
    expect(docTitle("```bash\n# a comment\n```\n", "fallback")).toBe("fallback");
    const readme = renderSurveyDoc(read("README.md"), "README.md", "argus-survey");
    expect(readme.startsWith("<h1>argus-survey</h1>")).toBe(true);
  });
});
