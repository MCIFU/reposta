import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@reposta/core'],
  poweredByHeader: false,
  async redirects() {
    return [{ source: '/sobre-los-datos', destination: '/datos', permanent: true }];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(self)' },
        ],
      },
    ];
  },
};

export default config;
