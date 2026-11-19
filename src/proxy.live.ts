import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, CSP_HEADER, cspMode, newNonce } from "@/lib/csp";

/**
 * A fresh CSP nonce per page request (see src/lib/csp.ts). Next.js reads it from
 * the *request's* CSP header for its own scripts. `x-nonce` hands it to the
 * layout for ours. Pages are already dynamic (layout.tsx), as nonces require.
 */
export function proxy(request: NextRequest) {
  // Computed key, as in runtimeConfig.ts: read at request time, never inlined at build.
  const mode = cspMode(process.env["ARGUS_SIGHTLINE_CSP"]);
  if (mode === "off") return NextResponse.next();
  const nonce = newNonce();
  const csp = buildCsp(nonce, { dev: process.env.NODE_ENV === "development" });
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set(CSP_HEADER[mode], csp); // Next.js reads the nonce from either header name
  const response = NextResponse.next({ request: { headers } });
  response.headers.set(CSP_HEADER[mode], csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: static chunks, the WASM and the favicon need no policy.
      source: "/((?!_next/static|_next/image|favicon.ico|laz-perf.wasm).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
