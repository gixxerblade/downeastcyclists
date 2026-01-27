/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuration for Netlify deployment
  distDir: '.next',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.ctfassets.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.contentful.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Configure static generation and ISR
  staticPageGenerationTimeout: 120, // Increase timeout for static generation (in seconds)
  serverExternalPackages: ['@google-cloud/firestore', 'firebase-admin'],

  // Turbopack configuration (empty to acknowledge we're using Turbopack)
  turbopack: {},

  // Add redirect from /about to /about/bylaws
  async redirects() {
    return [
      {
        source: '/about',
        destination: '/about/bylaws',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
