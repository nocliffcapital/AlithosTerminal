/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@alithos-terminal/shared'],
  // Ignore ESLint errors during build to prevent blocking deployments
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ignore TypeScript errors during build (optional - remove if you want type checking)
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cryptologos.cc',
      },
      {
        protocol: 'https',
        hostname: 'polymarket-upload.s3.us-east-2.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'turquoise-keen-koi-739.mypinata.cloud',
      },
    ],
  },
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    // Fix for package.json resolution issues in monorepo
    config.resolve.symlinks = true;
    return config;
  },
};

module.exports = nextConfig;

