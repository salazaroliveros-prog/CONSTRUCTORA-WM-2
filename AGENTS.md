# ERP Constructora WM - Agent Guidance

## Essential Commands
- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production (includes `--configLoader runner`)
- `npm run lint` - TypeScript type checking (`tsc --noEmit`)
- `npm run preview` - Preview production build locally

## Architecture Notes
- **SPA Routing**: Navigation via `?tab=` URL parameter (no router)
- **15 Modules**: Lazy-loaded via `React.lazy` + `Suspense` (dashboard, execution, clients, inventory, projects, suppliers, staff, analytics, settings, seed, seguimiento, clean, ai, gantt, effects)
- **Context Hierarchy**: AuthProvider → SettingsProvider → ThemeProvider → ProjectFilterProvider → Toaster
- **Theme System**: 3 dynamic themes (minimalist, cyberpunk, soft) managed by SettingsContext. Themes control CSS vars (bg, text, shadows, radius, chart colors) via `.theme-*` class on `<html>`. Settings syncs to localStorage (`app-visual-settings`) and Firestore (`userSettings/{uid}`). ThemeContext is standalone (legacy, overridden by SettingsProvider).
- **Auth**: Firebase Google OAuth - ONLY `salazaroliveros@gmail.com` authorized
- **Data Layer**: Firestore with ownerId filtering on ALL queries (`where('ownerId', '==', auth.currentUser.uid)`)
- **CSS**: TailwindCSS v4 (`@import "tailwindcss"` - NOT `@tailwind` directives). All theme vars in `src/index.css` with CSS custom properties.
- **Path Alias**: `@/*` maps to project root (`./*`)
- **API**: Vercel serverless function at `api/ai-report.ts` with Firebase JWT verification + Gemini 2.0 Flash streaming
- **Budget Engine**: Unified hierarchical budget management with advanced project creation interface. Key files: src/lib/budgetData.ts, src/components/BudgetTable.tsx, src/components/AdvancedProjectCreator.tsx, src/hooks/useBudget.ts, src/utils/budgetConverter.ts
- **Environment**: Requires `GEMINI_API_KEY` env var for AI features

## Type Gotchas
- **Project.status** is a union literal: `"EJECUCION" | "FINALIZADO" | "PAUSADO" | "COTIZACION"` — not `string`. Constructing a `fullProject` for PDF export with `...project` spread brings `status: string`, which breaks type checking. Use `as any` on PDF calls (generateBudgetPDF, generateBudgetPDFAPU, generateBudgetPDFEjecutivo, generateBudgetPDFCliente from `src/lib/reports`).
- **Cost fields**: Use `totals.indirectCost` / `totals.adminCost` — not `costBreakdown.*` (removed).
- **Format function**: `fmtQ` from `src/utils/format` — not `formatQ`.
- **Error parsing**: `parseError` from `src/utils/parseError`.
- **Missing imports** in ProjectBuilder.tsx when editing: `BudgetTable` (default export from `./BudgetTable`), `fmtQ`, `parseError`.

## Important Constraints
- **NO TESTS**: No test framework configured (vitest/jest/cypress/playwright)
- **DEPLOYMENT**: Primary - Vercel (see vercel.json), Secondary - Firebase Hosting
- **BUILD FLAG**: `npm run build` uses non-standard `--configLoader runner`
- **TS CONFIG**: `noEmit: true`, `paths: {"@/*": ["./*"]}`, `useDefineForClassFields: false`
- **HMR**: Can be disabled via `DISABLE_HMR=true` env var (used in AI studio)

## Settings Module
- Located at `src/components/Settings.tsx` (loaded via react-lazy in App)
- Manages: theme mode (minimalist/cyberpunk/soft), card style (elevated/flat/glass/bordered), typography (inter/space/mono), transition speed, compact mode, company info, currency, active modules, AI model config
- All settings persist to both localStorage (`app-visual-settings`) and Firestore (`userSettings/{uid}`) with 800ms debounce
- On reconnect (online event), settings auto-sync to Firestore
- The `useCardClass()` hook returns Tailwind card classes based on cardStyle setting

## File Conventions
- **License Headers**: Apache-2.0 SPDX identifier on many files
- **Language**: All-Spanish UI, currency in Quetzales (Q.)
- **Imports**:
  - Motion: `from 'motion/react'` (not framer-motion)
  - Firebase: Modular v9+ syntax
  - Lucide: Individual icon imports from `lucide-react`
- **Components**:
  - Layout: `src/components/Layout.tsx` (contains responsive drawer, navbar, mobile nav)
  - UI primitives: `src/components/ui/` (Animations, GradientHeader, Modal, Pagination)

## Known Issues
- **FIXED**: `vite.config.ts` `manualChunks` required function conversion (Vite 8/Rollup 4 compatibility)
- All Firestore queries filter by `ownerId` for multi-user isolation
- Service worker (`/sw.js`) registered in `main.tsx` for PWA offline support
