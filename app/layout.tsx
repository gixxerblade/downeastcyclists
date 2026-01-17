import './globals.css';
import '@fontsource/poppins/300.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/700.css';

import {AppRouterCacheProvider} from '@mui/material-nextjs/v14-appRouter';
import type {Metadata, Viewport} from 'next';

import {AuthProvider} from '@/src/components/auth/AuthProvider';
import FooterWrapper from '@/src/components/FooterWrapper';
import Navbar from '@/src/components/navbar';
import ThemeRegistry from '@/src/components/ThemeRegistry/ThemeRegistry';
import QueryProvider from '@/src/providers/QueryProvider';

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Down East Cycists',
  description: 'A Recreational Cycling Club in Eastern North Carolina',
  manifest: '/manifest.json',
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black',
    'format-detection': 'telephone=no',
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <head>
        {/* Add cache control meta tags */}
        <meta
          httpEquiv="Cache-Control"
          content="public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
        />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="86400" />
      </head>
      <body>
        <ThemeRegistry>
          <QueryProvider>
            <AuthProvider>
              <Navbar />
              <div className="content-wrapper">{children}</div>
              <FooterWrapper />
            </AuthProvider>
          </QueryProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
