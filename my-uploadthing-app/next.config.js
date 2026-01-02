// my-uploadthing-app/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
}
module.exports = nextConfig


// // my-uploadthing-app/next.config.js
// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   output: "standalone",
//   images: {
//     unoptimized: true, // evita depender de sharp en runtime
//   },
// };

// module.exports = nextConfig;



// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   output: 'standalone',
//   eslint: { ignoreDuringBuilds: true },
//   typescript: { ignoreBuildErrors: true },
// };
// module.exports = nextConfig;
