'use client';
import CssBaseline from '@mui/material/CssBaseline';
import {ThemeProvider} from '@mui/material/styles';
import * as React from 'react';

import NextAppDirEmotionCacheProvider from './EmotionCache';
import createAppTheme, {AppThemeMode} from './theme';
import {ThemeModeContext} from './ThemeModeContext';

export default function ThemeRegistry({children}: {children: React.ReactNode}) {
  const [mode, setMode] = React.useState<AppThemeMode>('light');

  React.useEffect(() => {
    const stored = window.localStorage.getItem('dec-theme') as AppThemeMode | null;
    const preferredDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setMode(stored === 'light' || stored === 'dark' ? stored : preferredDark ? 'dark' : 'light');
  }, []);

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
    document.documentElement.dataset.theme = mode;
    window.localStorage.setItem('dec-theme', mode);
  }, [mode]);

  const theme = React.useMemo(() => createAppTheme(mode), [mode]);
  const contextValue = React.useMemo(
    () => ({
      mode,
      toggleMode: () => setMode((current) => (current === 'light' ? 'dark' : 'light')),
    }),
    [mode],
  );

  return (
    <NextAppDirEmotionCacheProvider options={{key: 'mui'}}>
      <ThemeProvider theme={theme}>
        <ThemeModeContext.Provider value={contextValue}>
          <CssBaseline />
          {children}
        </ThemeModeContext.Provider>
      </ThemeProvider>
    </NextAppDirEmotionCacheProvider>
  );
}
