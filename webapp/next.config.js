/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  publicRuntimeConfig: {
    eventsContract: process.env.EVENTS_CONTRACT,
  },
}

module.exports = nextConfig
