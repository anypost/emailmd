import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  images: {
    localPatterns: [
      // Gallery screenshots carry a ?v=<hash> cache-buster (omitting `search` allows any query).
      {
        pathname: '/ss/**',
      },
      // Every other local image, no query string (the default behavior).
      {
        pathname: '/**',
        search: '',
      },
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'imgs.emailmd.dev',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.mdx/docs/:path*',
      },
    ];
  },
};

export default withMDX(config);
