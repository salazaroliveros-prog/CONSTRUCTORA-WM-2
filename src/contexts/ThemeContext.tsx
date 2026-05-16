import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type ThemeMode = 'minimalist' | 'cyberpunk' | 'soft';
const THEME_CYCLE: ThemeMode[] = ['minimalist', 'cyberpunk', 'soft'];
const STORAGE_KEY = 'opencode-theme-mode';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'minimalist',
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && THEME_CYCLE.includes(saved as ThemeMode)) return saved as ThemeMode;
    } catch {}
    return 'minimalist';
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
    const root = document.documentElement;
    THEME_CYCLE.forEach(t => root.classList.remove(`theme-${t}`));
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  const setTheme = useCallback((t: ThemeMode) => setThemeState(t), []);
  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const idx = THEME_CYCLE.indexOf(prev);
      return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);


