import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'classic' | 'modern' | 'brutalist' | 'minimal';
export type GraphType = 'bar' | 'line' | 'area';
export type CardStyle = 'flat' | 'elevated' | 'glass' | 'bordered';
export type TransitionSpeed = 'none' | 'fast' | 'normal' | 'slow';
export type TypographyStyle = 'inter' | 'space' | 'mono';
export type Currency = 'Q' | '$' | '€' | '£';

interface AppSettings {
  primaryColor: string;
  secondaryColor: string;
  themeMode: ThemeMode;
  graphType: GraphType;
  cardStyle: CardStyle;
  transitionSpeed: TransitionSpeed;
  typography: TypographyStyle;
  showGrid: boolean;
  compactMode: boolean;
  companyName: string;
  companyLogo: string;
  currency: Currency;
  activeModules: string[];
}

const ALL_MODULES = ['dashboard','clients','projects','calculator','execution','seguimiento','gantt','suppliers','inventory','analytics','staff','settings'];

const defaultSettings: AppSettings = {
  primaryColor: '#0F172A',
  secondaryColor: '#FBBF24',
  themeMode: 'modern',
  graphType: 'bar',
  cardStyle: 'elevated',
  transitionSpeed: 'normal',
  typography: 'inter',
  showGrid: true,
  compactMode: false,
  companyName: 'WM/M&S Constructora',
  companyLogo: '/logo.webp',
  currency: 'Q',
  activeModules: ALL_MODULES,
};

export { ALL_MODULES };

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('app-visual-settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('app-visual-settings', JSON.stringify(settings));

    // Inject dynamic CSS variables — only secondary (primary is handled by dark mode CSS)
    const root = document.documentElement;
    root.style.setProperty('--secondary', settings.secondaryColor);
    // Store user's brand primary for light mode only
    root.style.setProperty('--brand-primary', settings.primaryColor);

    // Apply themeMode class
    root.classList.remove('theme-modern', 'theme-classic', 'theme-brutalist', 'theme-minimal');
    root.classList.add(`theme-${settings.themeMode}`);

    // Apply compact mode
    if (settings.compactMode) {
      root.classList.add('compact-mode');
    } else {
      root.classList.remove('compact-mode');
    }

    // Apply card style as data attribute for CSS targeting
    root.setAttribute('data-card', settings.cardStyle);

    // Apply font to body
    const body = document.body;
    body.classList.remove('font-inter', 'font-space', 'font-mono');
    if (settings.typography === 'inter') body.classList.add('font-inter');
    if (settings.typography === 'space') body.classList.add('font-space');
    if (settings.typography === 'mono') body.classList.add('font-mono');
  }, [settings]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};

export const useCardClass = () => {
  const { settings } = useSettings();
  switch (settings.cardStyle) {
    case 'flat':     return 'bg-slate-50 border border-slate-100 shadow-none';
    case 'glass':    return 'bg-white/55 backdrop-blur-md border border-white/35 shadow-xl';
    case 'bordered': return 'bg-white border-2 border-slate-900 shadow-none';
    case 'elevated':
    default:         return 'bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow';
  }
};
