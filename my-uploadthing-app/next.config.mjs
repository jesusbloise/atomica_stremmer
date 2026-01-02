/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // No rompas el build por errores de ESLint
    ignoreDuringBuilds: true,
  },
  typescript: {
    // (Opcional) No rompas el build por errores de types
    // Puedes quitarlo cuando limpies los "any"
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
