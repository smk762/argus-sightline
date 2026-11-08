import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The API base is read per request (src/lib/runtimeConfig.ts); nothing here may depend on env.
};

export default nextConfig;
