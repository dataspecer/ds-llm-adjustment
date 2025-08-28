import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable ESLint during production builds to prevent build failures on lint errors
  // Lint is still available via `npm run lint`
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: 'standalone',
};

export default nextConfig;
