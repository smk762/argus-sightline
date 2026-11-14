import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AppHeader } from "@/components/AppHeader";
import { ExternalLink } from "@/components/ui";
import { DOC_PAGES, DOCS_ROOT, PYPI_URL, shortSha, sourceUrl, SURVEY } from "@/lib/surveyDocs";
import { docTitle, renderSurveyDoc } from "@/lib/surveyMarkdown";

/**
 * argus-survey's docs, imported at the pinned commit (docs/survey/, `make docs-pull`).
 * The files ship in the standalone build through next.config.ts's outputFileTracingIncludes.
 */

type Params = Promise<{ slug?: string[] }>;

// The imported files never change while the server runs (docs-pull writes them before a build),
// so each is read, titled and rendered once, not per request. A failed read is not kept.
function once<T>(make: (file: string) => Promise<T>): (file: string) => Promise<T> {
  const memo = new Map<string, Promise<T>>();
  return (file) => {
    let p = memo.get(file);
    if (!p) {
      p = make(file);
      memo.set(file, p);
      p.catch(() => memo.delete(file));
    }
    return p;
  };
}

const readDoc = once((file) => readFile(join(process.cwd(), "docs", "survey", file), "utf8"));
const titleOf = once(async (file) => docTitle(await readDoc(file), file));
const rendered = once(async (file) => renderSurveyDoc(await readDoc(file), file, "argus-survey"));

const pageFor = (slug: string[] | undefined) => {
  const key = (slug ?? []).join("/");
  return DOC_PAGES.find((p) => p.slug === key);
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const page = pageFor((await params).slug);
  if (!page) return {};
  return { title: `${docTitle(await readDoc(page.file), "argus-survey")} · argus-survey docs · Argus Sightline` };
}

export default async function SurveyDocsPage({ params }: { params: Params }) {
  const page = pageFor((await params).slug);
  if (!page) notFound();
  const nav = await Promise.all(DOC_PAGES.map(async (p) => ({ ...p, title: p.label ?? (await titleOf(p.file)) })));
  const html = await rendered(page.file);
  const link = "text-accent underline-offset-2 hover:underline";
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader health={null}>
        <span className="truncate text-[13px] text-muted">argus-survey docs</span>
      </AppHeader>
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
        <nav aria-label="argus-survey docs" className="lg:sticky lg:top-16 lg:self-start">
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] lg:flex-col lg:gap-0.5">
            {nav.map((p) => {
              const current = p.slug === page.slug;
              return (
                <li key={p.file}>
                  <Link
                    href={`${DOCS_ROOT}${p.slug ? `/${p.slug}` : ""}`}
                    aria-current={current ? "page" : undefined}
                    className={
                      current
                        ? "block rounded px-2 py-1 font-medium text-ink lg:bg-raised"
                        : "block rounded px-2 py-1 text-muted hover:text-ink"
                    }
                  >
                    {p.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <main className="min-w-0">
          <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line pb-3 text-[12.5px] text-muted">
            <span>
              <strong className="font-semibold text-ink-2">argus-survey {SURVEY.version}</strong> @{" "}
              <span className="num">{shortSha(SURVEY.commit)}</span>
            </span>
            <span aria-hidden="true">·</span>
            <ExternalLink href={sourceUrl()} className={link}>
              GitHub
            </ExternalLink>
            <span aria-hidden="true">·</span>
            <ExternalLink href={PYPI_URL} className={link}>
              PyPI
            </ExternalLink>
            <span className="basis-full text-[12px]">
              The docs this UI is synced to: the same commit as its wire types and recorded demo numbers.
            </span>
          </p>
          <article className="doc-prose" dangerouslySetInnerHTML={{ __html: html }} />
        </main>
      </div>
    </div>
  );
}
