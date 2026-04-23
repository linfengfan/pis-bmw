/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '50MB'
    }
  }
}

module.exports = nextConfig
