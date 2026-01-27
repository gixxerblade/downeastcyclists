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

  // Explicitly configure webpack to handle Firebase packages as externals
  webpack: (config, {isServer}) => {
    if (isServer) {
      // Mark Firebase packages as external to prevent bundling
      if (!Array.isArray(config.externals)) {
        config.externals = [];
      }

      // Add externals in the format Next.js expects
      const originalExternals = config.externals;
      config.externals = [
        ...originalExternals,
        ({context, request}, callback) => {
          if (
            request === '@google-cloud/firestore' ||
            request === 'firebase-admin' ||
            request.startsWith('firebase-admin/') ||
            request.startsWith('@google-cloud/firestore/')
          ) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
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
