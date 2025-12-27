/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    MAID_CENTRAL_API_BASE_URL: process.env.MAID_CENTRAL_API_BASE_URL || 'https://api.maidcentral.com',
  },
  // Exclude ultimate-agent and Culture Index folders from compilation
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules/**', '**/ultimate-agent/**', '**/Culture Index/**'],
    };
    return config;
  },
}

module.exports = nextConfig

