import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // The MCP route imports emailmd server-side; keep it (and mjml underneath)
  // resolved from node_modules instead of bundled.
  serverExternalPackages: ['emailmd'],
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
  async headers() {
    return [
      {
        // Default `::: social` icons, loaded by every email that has a social
        // block. Let clients and image proxies cache them for a week and serve
        // a stale copy while they check for a newer one.
        source: '/icons/social/:file',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' }],
      },
    ];
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
