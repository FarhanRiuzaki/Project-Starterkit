import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@starterkit/ui"],
  // No next/image in the app: skip the optimizer so sharp/libvips (≈ 28 MB) stays out of the standalone bundle.
  images: { unoptimized: true },
};

export default config;
