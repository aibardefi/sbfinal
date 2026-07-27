import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const basePath = isProd ? process.env.NEXT_PUBLIC_BASE_PATH || "" : "";

const nextConfig: NextConfig = {
  // Pin the root: the parent AlphaDEX app has its own lockfile alongside this one.
  turbopack: { root: __dirname },
  output: "export",
  basePath,
  assetPrefix: basePath,
  // Static export has no image optimization server.
  images: { unoptimized: true },
};

export default nextConfig;
