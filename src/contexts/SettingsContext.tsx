import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

export type ThemeMode = 'minimalist' | 'cyberpunk' | 'soft';
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
  aiModel: string;
  aiApiKey: string;
}

const ALL_MODULES = ['dashboard','clients','projects','calculator','execution','seguimiento','gantt','suppliers','inventory','analytics','staff','settings'];

const defaultSettings: AppSettings = {
  primaryColor: '#0F172A',
  secondaryColor: '#FBBF24',
  themeMode: 'minimalist',
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
  aiModel: 'gemini-2.5-flash',
  aiApiKey: '',
};

export { ALL_MODULES };

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SYNC_DEBOUNCE = 800;

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('app-visual-settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync down from Firestore on mount (remote wins)
  useEffect(() => {
    if (!user || !navigator.onLine) return;
    const syncDown = async () => {
      try {
        const ref = doc(db, 'userSettings', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const remote = snap.data() as Partial<AppSettings>;
          const merged = { ...defaultSettings, ...remote };
          setSettings(merged);
          localStorage.setItem('app-visual-settings', JSON.stringify(merged));
        }
      } catch {
        // Offline-first — localStorage is the fallback
      }
    };
    syncDown();
  }, [user]);

  // Persist to localStorage instantly + debounced sync up to Firestore
  useEffect(() => {
    localStorage.setItem('app-visual-settings', JSON.stringify(settings));

    // Inject dynamic CSS variables
    const root = document.documentElement;
    root.style.setProperty('--secondary', settings.secondaryColor);
    root.style.setProperty('--brand-primary', settings.primaryColor);

    root.classList.remove('theme-minimalist', 'theme-cyberpunk', 'theme-soft');
    root.classList.add(`theme-${settings.themeMode}`);

    if (settings.compactMode) {
      root.classList.add('compact-mode');
    } else {
      root.classList.remove('compact-mode');
    }

    root.setAttribute('data-card', settings.cardStyle);

    const body = document.body;
    body.classList.remove('font-inter', 'font-space', 'font-mono');
    if (settings.typography === 'inter') body.classList.add('font-inter');
    if (settings.typography === 'space') body.classList.add('font-space');
    if (settings.typography === 'mono') body.classList.add('font-mono');

    // Debounced Firestore sync
    if (!user) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      if (!navigator.onLine) return;
      try {
        const ref = doc(db, 'userSettings', user.uid);
        await setDoc(ref, settings, { merge: true });
      } catch {
        // Will retry on next change or reconnect
      }
    }, SYNC_DEBOUNCE);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [settings, user]);

  // Auto-sync when coming back online
  useEffect(() => {
    const onOnline = async () => {
      if (!user) return;
      try {
        const ref = doc(db, 'userSettings', user.uid);
        await setDoc(ref, settingsRef.current, { merge: true });
      } catch {
        // Offline-first — data is safe in localStorage
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [user]);

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
    case 'glass':
      return 'bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.07)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.11)] transition-all duration-300';
    case 'bordered':
      return 'bg-white/90 border-2 border-slate-900/80 shadow-[0_2px_12px_rgba(0,0,0,0.05)]';
    case 'flat':
      return 'bg-white/80 backdrop-blur-sm border border-slate-200/60 shadow-[0_1px_6px_rgba(0,0,0,0.04)]';
    case 'elevated':
    default:
      return 'bg-white border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.10)] transition-all duration-300';
  }
};
