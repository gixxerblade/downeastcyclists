'use client';

import {createContext, useContext} from 'react';

import type {AppThemeMode} from './theme';

export interface ThemeModeContextValue {
  mode: AppThemeMode;
  toggleMode: () => void;
}

export const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: 'light',
  toggleMode: () => {},
});

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
