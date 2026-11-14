import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The API base is read per request (src/lib/runtimeConfig.ts); nothing here may depend on env.
  // argus-survey's imported docs are read from disk at request time, so the standalone build must carry them.
  outputFileTracingIncludes: {
    "/docs/survey/**": ["./docs/survey/**/*"],
  },
};

export default nextConfig;
