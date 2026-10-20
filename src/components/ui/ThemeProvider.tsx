import React, { createContext, useContext, useEffect } from 'react';
import { useThemeStore } from '../../stores/useThemeStore.ts';
import { ThemeMode, ColorTheme } from '../../types/index.ts';

interface ThemeContextType {
  theme: ThemeMode;
  colorTheme: ColorTheme;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => void;
  setColorTheme: (colorTheme: ColorTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = useThemeStore();

  useEffect(() => {
    // Permanently ensure dark class is removed everywhere in DOM
    document.documentElement.classList.remove('dark');
  }, []);

  return (
    <ThemeContext.Provider value={store}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return useThemeStore();
  }
  return context;
};
