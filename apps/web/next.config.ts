/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    HIGHNOTE_SK_LIVE_KEY: process.env.HIGHNOTE_SK_LIVE_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  },
};

export default nextConfig;