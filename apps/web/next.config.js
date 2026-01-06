/** @type {import('next').NextConfig} */
const nextConfig = {
  // ⚠️ Mientras limpiamos types y lint
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Variables de entorno públicas en runtime
  env: {
    HIGHNOTE_SK_LIVE_KEY: process.env.HIGHNOTE_SK_LIVE_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  },
};

module.exports = nextConfig;



// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   typescript: { ignoreBuildErrors: true },
//   eslint: { ignoreDuringBuilds: true },
// }
// module.exports = nextConfig

