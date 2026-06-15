import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep local dev artifacts separate so `next build` cannot corrupt a running dev server.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next'
};

export default nextConfig;
