import { create } from 'zustand';
import { ThemeMode, ColorTheme } from '../types/index.ts';

interface ThemeState {
  theme: ThemeMode;
  colorTheme: ColorTheme;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => void;
  setColorTheme: (colorTheme: ColorTheme) => void;
  toggleTheme: () => void;
}

const applyThemeToDOM = (colorTheme: ColorTheme): boolean => {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement;
  // Always enforce pure light theme across the application
  root.classList.remove('dark');
  root.setAttribute('data-color-theme', colorTheme);
  return false;
};

export const useThemeStore = create<ThemeState>((set) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('familyroots-theme', 'light');
  }
  applyThemeToDOM('heritage');

  return {
    theme: 'light',
    colorTheme: 'heritage',
    isDark: false,
    setTheme: () => {
      // Locked to light theme as requested
      applyThemeToDOM('heritage');
      set({ theme: 'light', isDark: false });
    },
    setColorTheme: (colorTheme: ColorTheme) => {
      localStorage.setItem('familyroots-color-theme', colorTheme);
      applyThemeToDOM(colorTheme);
      set({ colorTheme, isDark: false });
    },
    toggleTheme: () => {
      // Kept permanently in light mode
      applyThemeToDOM('heritage');
      set({ theme: 'light', isDark: false });
    },
  };
});
