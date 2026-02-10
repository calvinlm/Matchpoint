/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverSourceMaps: false,
  },
  productionBrowserSourceMaps: false,
};

module.exports = nextConfig;
