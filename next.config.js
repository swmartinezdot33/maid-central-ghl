/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    MAID_CENTRAL_API_BASE_URL: process.env.MAID_CENTRAL_API_BASE_URL || 'https://api.maidcentral.com',
  }
}

module.exports = nextConfig

