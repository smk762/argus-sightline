import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { runtimeConfig, runtimeConfigScript } from "@/lib/runtimeConfig";
import { THEME_BOOT } from "@/lib/theme";

/**
 * LOAD-BEARING: the API base comes from the container's environment at request
 * time (argus-studio#56). Without this the layout is prerendered and the
 * builder's env is baked into `window.__SIGHTLINE_ENV__`.
 */
export const dynamic = "force-dynamic";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Argus Sightline",
  description: "The argus-survey workspace. Point clouds to survey deliverables: datums you can see, accuracy you can defend.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU" className={`${sans.variable} ${mono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        {/* Read during render only, never at client module scope (see runtimeConfig.ts). */}
        <script dangerouslySetInnerHTML={{ __html: runtimeConfigScript(runtimeConfig()) }} />
      </head>
      <body className="min-h-full font-sans text-[14px] leading-snug">{children}</body>
    </html>
  );
}
