/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  publicRuntimeConfig: {
    eventsContract: process.env.EVENTS_CONTRACT,
    pollsContract: process.env.POLLS_CONTRACT,
    chainId: process.env.CHAIN_ID,
    chainName: process.env.CHAIN_NAME,
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
