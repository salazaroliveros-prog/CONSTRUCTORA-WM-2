import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'classic' | 'modern' | 'brutalist' | 'minimal';
export type GraphType = 'bar' | 'line' | 'area';
export type CardStyle = 'flat' | 'elevated' | 'glass' | 'bordered';
export type TransitionSpeed = 'none' | 'fast' | 'normal' | 'slow';
export type TypographyStyle = 'inter' | 'space' | 'mono';

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
}

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const defaultSettings: AppSettings = {
  primaryColor: '#0F172A', // Slate 900
  secondaryColor: '#FBBF24', // Amber 400
  themeMode: 'modern',
  graphType: 'bar',
  cardStyle: 'elevated',
  transitionSpeed: 'normal',
  typography: 'inter',
  showGrid: true,
  compactMode: false,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('app-visual-settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('app-visual-settings', JSON.stringify(settings));
    
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
