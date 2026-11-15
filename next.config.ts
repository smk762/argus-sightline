import type { NextConfig } from "next";

// Two builds from one tree:
//
// - Live (default): a standalone server (Docker) that reads its config per request and drives an
//   argus-survey API. The docs image route (route.live.ts), the per-request CSP (src/proxy.live.ts) and the
//   dynamic root layout are part of it.
// - Hosted demo (`SIGHTLINE_STATIC=1`, `make pages`): a pure static export to out/ that replays the recorded
//   tape in public/data-tape (src/lib/staticApi.ts). Files named *.live.ts(x) are routes only to the live
//   build's pageExtensions; scripts/csp.mjs copies the docs images and gives every exported page a
//   hash-based CSP.
const staticDemo = process.env.SIGHTLINE_STATIC === "1" || process.env.NEXT_PUBLIC_SIGHTLINE_STATIC === "1";

const nextConfig: NextConfig = {
  pageExtensions: staticDemo ? ["tsx", "ts"] : ["live.tsx", "live.ts", "tsx", "ts"],
  env: { NEXT_PUBLIC_SIGHTLINE_STATIC: staticDemo ? "1" : "" },
  ...(staticDemo
    ? { output: "export" as const, trailingSlash: true, images: { unoptimized: true } }
    : {
        output: "standalone" as const,
        // The API base is read per request (src/lib/runtimeConfig.ts); nothing here may depend on env.
        // argus-survey's imported docs are read from disk at request time, so the standalone build must carry them.
        outputFileTracingIncludes: {
          "/docs/survey/**": ["./docs/survey/**/*"],
        },
        // The hosted demo's tape is not part of the live app (.dockerignore drops it from the image too).
        outputFileTracingExcludes: {
          "/jobs/**": ["./public/data-tape/**"],
        },
      }),
};

export default nextConfig;
