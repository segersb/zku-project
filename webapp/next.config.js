/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  publicRuntimeConfig: {
    eventsContract: process.env.EVENTS_CONTRACT,
    eventsChainId: process.env.EVENTS_CHAIN_ID,
    eventsChainName: process.env.EVENTS_CHAIN_NAME,
  },

  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        readline: false,
      }
    }
    return config
  }

}

module.exports = nextConfig
