import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Workspace } from "@/components/workspace/Workspace";
import { staticDemo } from "@/lib/demo";

/**
 * The hosted demo exports one page per recorded job (public/data-tape/jobs.json). The live build renders any id
 * on request, so there it has no generateStaticParams at all: with one, Next prerenders the route and the
 * layout's per-request headers() fails it (DYNAMIC_SERVER_USAGE).
 */
export const generateStaticParams = staticDemo() ? recordedJobs : undefined;

async function recordedJobs(): Promise<{ id: string }[]> {
  const { jobs } = JSON.parse(await readFile(join(process.cwd(), "public", "data-tape", "jobs.json"), "utf8")) as { jobs: { job_id: string }[] };
  return jobs.map((j) => ({ id: j.job_id }));
}

export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ demo?: string }>;
}) {
  const { id } = await params;
  // A static export has no query string at build time; the guided-demo flag is a live-API feature anyway.
  const demo = staticDemo() ? false : (await searchParams).demo === "1";
  return <Workspace jobId={decodeURIComponent(id)} demo={demo} />;
}
