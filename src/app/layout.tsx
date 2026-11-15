import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DemoStrip, STRIP_SITE } from "@/components/DemoStrip";
import { staticDemo } from "@/lib/demo";
import { runtimeConfig, runtimeConfigScript } from "@/lib/runtimeConfig";

/**
 * LOAD-BEARING: the API base comes from the container's environment at request
 * time (argus-studio#56), so the live layout must never be prerendered with the
 * builder's env baked into `window.__SIGHTLINE_ENV__`. Its `headers()` call (the
 * CSP nonce) makes every route dynamic; `force-dynamic` can't say so here, since
 * segment config must be a literal and the hosted demo (`staticDemo()`) is a
 * static export. src/lib/sync.test.ts checks the live build keeps that call.
 */

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const DESCRIPTION = "The argus-survey workspace. Point clouds to survey deliverables: datums you can see, accuracy you can defend.";
const DEMO_DESCRIPTION =
  "Argus Sightline, the survey workspace for argus-survey: ground, DTM/DSM, contours and a stockpile volume from public USGS LiDAR, replayed from a recorded run.";

export const metadata: Metadata = {
  title: staticDemo() ? "Argus Sightline demo · Dragonhound Labs" : "Argus Sightline",
  description: staticDemo() ? DEMO_DESCRIPTION : DESCRIPTION,
  // Favicons: argus-cortex brand/packages/survey/favicon/, copied unchanged. favicon.ico, icon.svg and
  // apple-icon.png sit in src/app/ and Next emits their tags; icon-192/512 in public/ are for the manifest.
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = { colorScheme: "dark light" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (staticDemo()) {
    // No inline scripts: the family theme script (public/dh-theme.js) is added blocking, first in <head>,
    // by scripts/csp.mjs, next to its Trusted Types policy (React would create it through innerHTML on a
    // client render, which that policy blocks). The config is STATIC_CONFIG (runtimeConfig.ts).
    return (
      <html lang="en" data-dh-site={STRIP_SITE} className={`${sans.variable} ${mono.variable} h-full antialiased`} suppressHydrationWarning>
        <body className="min-h-full font-sans text-[14px] leading-snug">
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <DemoStrip />
          {children}
        </body>
      </html>
    );
  }
  // Set by src/proxy.live.ts. Next.js nonces its own scripts; these two are ours to stamp.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en-AU" className={`${sans.variable} ${mono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/*
          The family theme script (public/dh-theme.js, a copy of vendor/dh/dh-theme.js): blocking and first,
          so the saved choice is on <html> before the first paint.
        */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- blocking on purpose: it must set the theme before first paint */}
        <script nonce={nonce} src="/dh-theme.js" />
        {/* Read during render only, never at client module scope (see runtimeConfig.ts). */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: runtimeConfigScript(runtimeConfig()) }} />
      </head>
      <body className="min-h-full font-sans text-[14px] leading-snug">{children}</body>
    </html>
  );
}
