import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pins from "../../../../../../schema/pins.json";

/** Images from argus-survey's docs, served from this origin. Only files the sync record pins are served. */

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const file = `docs/img/${name}`;
  const type = TYPES[name.split(".").pop()?.toLowerCase() ?? ""];
  if (!type || !(file in (pins.survey.docs as Record<string, string>))) return new Response("Not found", { status: 404 });
  const body = await readFile(join(process.cwd(), "docs", "survey", file));
  return new Response(body, {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
