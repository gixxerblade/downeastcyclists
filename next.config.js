/** @type {import('next').NextConfig} */
const nextConfig = {
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
  // Use a more balanced approach to caching
  onDemandEntries: {
    // Keep the build cache for a reasonable time
    maxInactiveAge: 60 * 60 * 1000, // 1 hour
    // Number of pages to keep in memory
    pagesBufferLength: 5,
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
