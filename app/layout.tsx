import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/src/components/navbar';
import '@fontsource/poppins/300.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/700.css';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import ThemeRegistry from '@/src/components/ThemeRegistry/ThemeRegistry';

export const metadata: Metadata = {
  title: 'Down East Cycists',
  description: 'A Recreational Cycling Club in Eastern North Carolina',
}

export default function RootLayout ({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
          <Navbar />
          {children}
        </ThemeRegistry>
      </body>
    </html>
  );
}
