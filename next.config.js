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
  // Enhanced caching configuration
  onDemandEntries: {
    // Keep the build cache for a longer time
    maxInactiveAge: 24 * 60 * 60 * 1000, // 24 hours
    // Increase number of pages to keep in memory
    pagesBufferLength: 10,
  },
  // Configure static generation and ISR
  staticPageGenerationTimeout: 120, // Increase timeout for static generation (in seconds)
  experimental: {
    // Optimize serverless function size
    serverComponentsExternalPackages: ['@google-cloud/firestore'],
  },
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
