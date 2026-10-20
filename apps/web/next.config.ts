import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  // NEXT_DIST_DIR=.next-e2e for E2E and verification builds, so they never overwrite a running dev server's .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@starterkit/shared", "@starterkit/ui"],
  // No next/image in the app: skip the optimizer so sharp/libvips (≈ 28 MB) stays out of the standalone bundle.
  images: { unoptimized: true },
};

export default config;
