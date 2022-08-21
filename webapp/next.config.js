/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  publicRuntimeConfig: {
    eventsContract: process.env.EVENTS_CONTRACT,
  },

  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    if (!isServer) {
      // config.plugins.push(
      //   new webpack.ProvidePlugin({
      //     global: "global"
      //   })
      // )
      //
      // config.resolve.fallback = {
      //   fs: false,
      //   stream: false,
      //   crypto: false,
      //   os: false,
      //   readline: false,
      //   ejs: false,
      //   assert: require.resolve("assert"),
      //   path: false,
      //   constants: false
      // }

      config.resolve.fallback = {
        fs: false,
        readline: false,
      }

      return config
    }

    return config
  }

}

module.exports = nextConfig
