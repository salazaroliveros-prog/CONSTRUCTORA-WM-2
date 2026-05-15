# ERP Constructora WM — Agent Guidance

> Compact instructions to avoid mistakes and ramp up quickly in future sessions.

## Quick Start

```bash
npm run dev          # Vite dev server on :5173, proxies /api → http://localhost:3000
npm run build        # Production build (Vite 8 + Rollup 4, non-standard --configLoader runner)
npm run lint         # tsc --noEmit (the project's type checker — NOT eslint)
npm run preview      # Preview production build locally on :4173
```

**Build order matters:** `npm run lint` → fix errors → `npm run build`.

**Dev server with API proxy:** The Vite dev server proxies `/api/*` to `http://localhost:3000`. For local API testing run `npx vercel dev` alongside.

---

## Architecture

- **SPA routing** via `?tab=` URL parameter — no React Router. Module switching is lazy (`React.lazy` + `Suspense`) across 13 tabs: `dashboard`, `execution`, `clients`, `inventory`, `projects`, `suppliers`, `staff`, `analytics`, `settings`, `seguimiento`, `ai`, `gantt`, `effects`.
- **Context hierarchy:** `AuthProvider` → `SettingsProvider` → `ThemeProvider` → `ProjectFilterProvider` → `Toaster`.
- **Auth:** Firebase Google OAuth (redirect-based, `browserLocalPersistence`). Only `salazaroliveros@gmail.com` is authorized. See `src/contexts/AuthContext.tsx`. `signInWithPopup` is used (not redirect) to avoid Chrome third-party cookie blocks.
- **Data layer:** Firestore with `where('ownerId', '==', auth.currentUser.uid)` on every query. Generic CRUD lives in `src/services/firestoreService.ts`.
- **PWA:** Service worker at `/public/sw.js`, registered in `src/main.tsx`. Offline-first via Dexie.js + IndexedDB (see Sync section below).
- **Deploy:** Vercel (`vercel.json`). SPA fallback rewrite, security headers, no-cache on HTML.

---

## Monorepo Layout (Key Paths)

| Path | Purpose |
|---|---|
| `src/models/` | Domain models — `engineering.ts`, `budget.ts`, `client.ts`, `project.ts`, `index.ts` |
| `src/engine/budgetEngine.ts` | Core calculation engine (v4). **Single source of truth** for budget math (~660 lines) |
| `src/engine/precision.ts` | `PMath` namespace, `precise()`, `fmtQ()`, `fmtInput()` — IEEE 754-safe arithmetic |
| `src/lib/budgetData.ts` | Backward-compat re-exports: `BudgetLine`, `LineResult`, `ProjectTotals`, `Deviation`, `ENGINEERING` |
| `src/lib/budgetDataRaw.ts` | 22 default budget lines across 5 typologies (raw data) |
| `src/lib/reportEngine.ts` | **Unified** PDF/CSV/JSON/BOM report generator (~1062 lines). Prefer over `reports.ts` |
| `src/lib/reports.ts` | **Legacy** duplicate report logic (being phased out). Uses old `Project` type |
| `src/constants.ts` | Old `Project`, `WorkItem`, `Material`, `Labor`, `Typology` — used by legacy UI |
| `src/components/` | React components. `BudgetTable.tsx` (1582 lines) and `Projects.tsx` are largest |
| `src/components/AdvancedProjectCreator/` | New project wizard: `ProjectBuilder`, `ProjectSummary`, `ProjectHeader`, `PurchaseOrderPanel`, `ProjectItemsList` |
| `src/components/BudgetTable/DimensionEditor.tsx` | Dimension sub-editor inside budget table |
| `src/contexts/` | Four React contexts: `AuthContext`, `SettingsContext`, `ThemeContext`, `ProjectFilterContext` |
| `src/settings/` | Settings module at `src/components/Settings.tsx` (lazy-loaded, theme + persistence) |
| `src/lib/sync/` | Offline-first sync: `SyncEngine.ts`, `RealtimeSync.ts`, `store.ts` (Dexie), `types.ts` |
| `src/store/DataStore.ts` | Centralized DataStore with real-time subscriptions |
| `src/utils/budgetConverter.ts` | Bidirectional converters: `BudgetItem` ↔ `BudgetLine` |
| `middleware.ts` | Vercel Edge middleware — security headers only, never blocks `/api/*` |

---

## Sync / Offline-First (`src/lib/sync/`)

- **Dexie.js** over IndexedDB — queries, indexes, ACID transactions.
- **SyncEngine** (`SyncEngine.ts`): PUSH/PULL with vector clocks, field-level conflict resolution (numerics: max, strings: LWW, arrays: merge by ID), retry queue with exponential backoff.
- **RealtimeSync** (`RealtimeSync.ts`): Firestore snapshot listeners → Dexie local cache → instant UI.
- **Conflict resolution** is automatic; unresolved conflicts are stored in `conflicts` table and surfaced via `SyncStatus.tsx` UI indicator.
- **Persistence mode:** `browserLocalPersistence` — same device auto-logs in, new device requires login.

---

## TypeScript — Critical Gotchas

1. **`BudgetLine` type alias is a trap.** `src/models/budget.ts:464` — `export type BudgetLine = BudgetLineDocument`. Constructing objects requires the full `BudgetLineDocument` shape, not `BudgetLine`.

2. **`Project.status` is a literal union, not `string`:**
   ```ts
   type ProjectStatus = 'COTIZACION' | 'EJECUCION' | 'FINALIZADO' | 'PAUSADO';
   ```
   Spreading a Firestore doc (`...project`) produces `status: string`, breaking type checks. Use `as any` on PDF calls in `reportEngine.ts`.

3. **Two `Typology` enums exist** — `src/constants.ts` and `src/models/engineering.ts`. Identical values, different declarations. Imports must match the file's source — do not mix.

4. **`ENGINEERING` constant** in `budgetEngine.ts` lacks `as const`. Types come from explicit cast (`as SteelRatios`). Do not add `as const` or steel ratio assignments will break.

5. **`budgetDataRaw.ts` circular import risk** — uses `import { BudgetLineDocument } from '../models/budget'` for type+value. If `models/budget.ts` ever re-exports something importing `budgetDataRaw`, it circulars. Keep the import type-only where possible.

6. **Old `Project` (constants.ts) vs new model (models/project.ts).** Legacy has `items: ProjectItem[]`, `marketLevel`, `slabType`, `area`. Report engine (`reportEngine.ts`) bridges both.

7. **`financialConfig` vs individual params.** `FinancialConfig` (in `engineering.ts`) is used in `CalcInput`, but many engine functions accept `indirectCosts`, `adminCosts`, `personalCosts` individually. Do not confuse the two forms.

8. **`tsconfig.json`**: `experimentalDecorators: true`, `useDefineForClassFields: false`, `moduleResolution: "bundler"`, `allowImportingTsExtensions: true`. These are required for the codebase to compile cleanly.

---

## Currency & Number Formatting

- **Currency:** Guatemalan Quetzal (GTQ), symbol `Q.`, 2 decimal places, thousand separator `,`
- **`fmtQ(n)`** in `src/utils/format.ts` — primary formatter → `"Q 1,234.56"`
- **`fmtQty(n)`** in `src/engine/precision.ts` — engine formatter (same output)
- **`fmtInput(n)`** — input fields → `"1,234.56"` (no `Q.` prefix)
- **Never use `formatQ`** — it does not exist. Use `fmtQ`.

---

## Firestore Collections

Required collections (defined in `firestoreService.ts:REQUIRED_COLLECTIONS`):
`projects`, `clients`, `staff`, `suppliers`, `inventory`, `transactions`, `purchaseOrders`, `logs`

All queries filter by `ownerId`. `generateProjectStock()` auto-creates inventory items from budget materials when a project enters `EJECUCION` status. Firebase project: `coonstructora-wm-mys`.

---

## Report System (Two Generations)

**`src/lib/reportEngine.ts`** (new, unified) — all PDF generators and CSV/JSON:
- `generateBudgetPDF` — full 4+ page budget
- `generateBudgetPDFEjecutivo` — compact executive quote
- `generateBudgetPDFCliente` — client-facing summary
- `generateBudgetPDFAPU` — unit price analysis
- `generateProgressReport` — physical/financial progress
- `generateBudgetCSV`, `generateBudgetJSON`, `generateBOM`

**`src/lib/reports.ts`** (legacy, duplicate) — same functions, old `Project` type. Being phased out.

Both use `jspdf` + `jspdf-autotable`. Colors are hardcoded RGB tuples (corporate palette).

---

## Vite / Toolchain Quirks

- **`manualChunks`** in `vite.config.ts` is a **regular function** (not arrow) for Rollup 4 compatibility.
- **`firebase-admin`** is listed in `dependencies` but must NEVER be imported in client code. Vite's `external: []` + `manualChunks` routes it to a separate chunk. If you import it client-side the build will include Node.js shims and bloat the bundle.
- **Path alias:** `@` maps to project root (`./*`). Configured in both `tsconfig.json` and `vite.config.ts`.
- **Tailwind v4** via `@tailwindcss/vite` plugin — uses `@import "tailwindcss"` in CSS, **not** `@tailwind` directives.
- **Motion** library: import from `'motion/react'`, not `'framer-motion'`.
- **Lucide icons:** individual imports from `'lucide-react'`.
- **HMR** disabled via `DISABLE_HMR=true` env var (used for AI studio stability).
- **`GEMINI_API_KEY`** required for AI features, injected via `vite.config.ts` `define`. Must be present in `.env.local` for dev, and in Vercel env vars for production.
- **No test framework** configured — no vitest, jest, cypress, or playwright.

---

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | `.env.local` (dev) / Vercel Dashboard (prod) | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Same | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Same | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Same | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Same | Firebase messaging sender |
| `VITE_FIREBASE_APP_ID` | Same | Firebase app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Same | Firebase analytics measurement |
| `VITE_GEMINI_API_KEY` | Same | Gemini AI API key |
| `FIREBASE_CLIENT_EMAIL` | Vercel Dashboard only | Service account email (serverless `/api/auth/session`) |
| `FIREBASE_PRIVATE_KEY` | Vercel Dashboard only | Service account private key (replace `\n` with actual newlines) |

**`VITE_*`** = client-bundled (Vite replaces at build time). **`FIREBASE_*`** (no prefix) = serverless only (`process.env`, never reaches browser).

---

## Settings Persistence

All settings persist to **both** `localStorage` (`app-visual-settings`) and Firestore (`userSettings/{uid}`) with 800ms debounce. On reconnect, settings auto-sync from Firestore.

---

## Common Import Paths

```ts
// Budget types
import { BudgetLineDocument, LineCalcResult, BudgetTotals } from '../models/budget';
import { ENGINEERING, FinancialConfig, SteelRatios } from '../models/engineering';

// Engine
import { calculateProject, calculateTree, calcLine } from '../engine/budgetEngine';

// Legacy compat (used by old components)
import { BudgetLine, LineResult, ProjectTotals } from '../lib/budgetData';

// Formatting
import { fmtQ } from '../utils/format';

// Firebase
import { db, auth } from '../lib/firebase';

// Sync
import { useSync } from '../contexts/AuthContext';

// Types from old constants
import { Project, Typology } from '../constants';
```

---

## Deploy

- **Target:** Vercel, project `constructora-wm-2` → https://constructora-wm-2.vercel.app
- **Config:** `vercel.json` — framework `vite`, region `gru1`, SPA rewrite, security headers.
- **Middleware:** `middleware.ts` — security headers only; does **not** intercept `/api/*` routes.
- **Firebase config:** `firebase.json` — only Firestore/Storage rules (no `hosting` section to avoid confusing Vercel).
- **Service account:** Set `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` in Vercel Dashboard → Settings → Environment Variables.

---

## Key Decisions

- Firebase Admin **not** in client bundle — `/api/auth/session` is a serverless REST endpoint.
- `signInWithPopup` over `signInWithRedirect` — avoids Chrome third-party cookie issues.
- `browserLocalPersistence` — same device auto-logs in; new device requires login.
- Dexie.js for offline storage — full query/transaction support over raw IndexedDB.
- Vector clocks for automatic conflict detection and field-level merge.

---

## Recent Improvements (2026-05-14)

### 1. SettingsContext now uses `firestoreService` centralizado
- `SettingsContext.tsx` eliminó las importaciones directas de `doc()`, `getDoc()`, `setDoc()` de `firebase/firestore`.
- Ahora usa `loadUserSettings(uid)` y `saveUserSettings(uid, data)` desde `src/services/firestoreService.ts`.
- Si cambia la colección de settings, solo se toca `firestoreService.ts`.

### 2. Auto-generación de stock al entrar en EJECUCION
- `updateDocument()` en `firestoreService.ts` detecta cuando un proyecto cambia de estado a `EJECUCION`.
- Llama automáticamente a `generateProjectStock()` para crear los items de inventario desde el presupuesto.
- Solo se ejecuta si el estado **realmente** cambió (verifica `currentData.status !== 'EJECUCION'`).

### 3. `writeWithOfflineQueue()` — escritura offline-first
- Nueva función en `firestoreService.ts` que envuelve escrituras con soporte offline.
- Intenta escritura directa en Firestore; si falla (offline), encola en `SyncEngine`.
- Siempre encola en `SyncEngine` para garantizar consistencia offline.
- Se puede usar desde cualquier componente: `writeWithOfflineQueue('projects', id, data, 'update')`.

### 4. Funciones dedicadas para `userSettings`
- `loadUserSettings(uid)` — carga configuración sin importar `firebase/firestore` en el componente.
- `saveUserSettings(uid, data)` — guarda configuración con `sanitize()` y `merge: true`.
- Siguen el mismo patrón que `addDocument`/`updateDocument` para el resto de colecciones.