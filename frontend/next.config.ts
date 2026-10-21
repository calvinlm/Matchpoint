import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverSourceMaps: false,
  },
  productionBrowserSourceMaps: false,
};

export default nextConfig;
