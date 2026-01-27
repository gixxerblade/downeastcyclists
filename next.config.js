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

  // Mark Firebase packages as external (not bundled by Next.js)
  serverExternalPackages: ['@google-cloud/firestore', 'firebase-admin'],

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
