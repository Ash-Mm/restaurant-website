/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  transpilePackages: ['@restaurant/ui', '@restaurant/config'],
};

export default nextConfig;
