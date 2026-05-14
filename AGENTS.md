# ERP Constructora WM — Agent Guidance

> Compact instructions to avoid mistakes and ramp up quickly in future sessions.

## Quick Start

```bash
npm run dev          # Vite dev server on :5173, proxies /api → localhost:3000
npm run build        # Production build (Vite 8 + Rollup 4, non-standard --configLoader runner)
npm run lint         # tsc --noEmit (the project's type checker — NOT eslint)
npm run preview      # Preview production build locally
```

**Build order matters:** `npm run lint` → fix errors → `npm run build`.

---

## Architecture

- **SPA routing** via `?tab=` URL parameter — no React Router. Module switching is lazy (`React.lazy` + `Suspense`) across 13 tabs: `dashboard`, `execution`, `clients`, `inventory`, `projects`, `suppliers`, `staff`, `analytics`, `settings`, `seguimiento`, `ai`, `gantt`, `effects`.
- **Context hierarchy:** `AuthProvider` → `SettingsProvider` → `ThemeProvider` → `ProjectFilterProvider` → `Toaster`
- **Auth:** Firebase Google OAuth (redirect-based). Only `salazaroliveros@gmail.com` is authorized. See `src/contexts/AuthContext.tsx`.
- **Data layer:** Firestore with `where('ownerId', '==', auth.currentUser.uid)` on every query. Generic CRUD lives in `src/services/firestoreService.ts`.
- **PWA:** Service worker at `/sw.js`, registered in `src/main.tsx`. Offline-first.
- **Deploy:** Vercel (`vercel.json`). SPA fallback rewrite, security headers, no-cache on HTML.

---

## Monorepo Layout (Key Paths)

| Path | Purpose |
|---|---|
| `src/models/` | Domain models — `engineering.ts`, `budget.ts`, `client.ts`, `project.ts`, `index.ts` |
| `src/engine/budgetEngine.ts` | Core calculation engine (v4 rewrite). **Single source of truth** for budget math. |
| `src/engine/precision.ts` | `PMath` namespace, `precise()`, `fmtQ()`, `fmtInput()` — IEEE 754-safe arithmetic |
| `src/lib/budgetData.ts` | Backward-compat re-exports: `BudgetLine`, `LineResult`, `ProjectTotals`, `Deviation`, `ENGINEERING` |
| `src/lib/budgetDataRaw.ts` | 22 default budget lines across 5 typologies (raw data, imports from `models/budget`) |
| `src/lib/reportEngine.ts` | **Unified** PDF/CSV/JSON/BOM report generator (1062 lines). Prefer this over `reports.ts`. |
| `src/lib/reports.ts` | **Legacy** duplicate report logic (being phased out). Uses old `Project` type from `constants.ts`. |
| `src/constants.ts` | Old `Project`, `WorkItem`, `Material`, `Labor`, `Typology` — used by legacy UI components |
| `src/components/` | React components. `BudgetTable.tsx` (1582 lines) and `Projects.tsx` are the largest consumers. |
| `src/components/AdvancedProjectCreator/` | New project wizard: `ProjectBuilder.tsx`, `ProjectSummary.tsx`, `ProjectHeader.tsx`, `PurchaseOrderPanel.tsx`, `ProjectItemsList.tsx` |
| `src/components/BudgetTable/DimensionEditor.tsx` | Dimension sub-editor inside budget table |
| `src/contexts/` | Four React contexts: `AuthContext`, `SettingsContext`, `ThemeContext`, `ProjectFilterContext` |
| `src/settings/` | Settings module at `src/components/Settings.tsx` (lazy-loaded, manages theme + persistence) |

---

## TypeScript — Critical Gotchas

1. **`BudgetLine` type alias is a trap.** `src/models/budget.ts:464` defines `export type BudgetLine = BudgetLineDocument` — it's an alias, not a new type. When constructing objects, you need the full `BudgetLineDocument` shape.

2. **`Project.status` is a literal union, not `string`:**
   ```ts
   type ProjectStatus = 'COTIZACION' | 'EJECUCION' | 'FINALIZADO' | 'PAUSADO';
   ```
   Spreading a Firestore `...project` produces `status: string`, which breaks type checks. Use `as any` on PDF calls (`generateBudgetPDF`, `generateBudgetPDFAPU`, etc. in `src/lib/reportEngine.ts`).

3. **Two `Typology` enums exist.** `src/constants.ts` has one, `src/models/engineering.ts` has another. They are identical values but different declarations. Imports must match the file's source — don't mix them.

4. **`ENGINEERING` constant in `budgetEngine.ts`** (line 42) is declared locally with `as const`, making all properties readonly literal types. Assigning number values to `steelRatios` fields from a wider type fails — widen the type or cast explicitly.

5. **`budgetDataRaw.ts` circular import:** Uses `import { BudgetLineDocument } from '../models/budget'` for both type and value. If `models/budget.ts` ever re-exports something that imports `budgetDataRaw`, it circulars. Keep the import type-only where possible.

6. **Old `Project` type (in `constants.ts`) vs new model.** The legacy `Project` has `items: ProjectItem[]`, `marketLevel`, `slabType`, `area`, etc. The new model lives in `models/project.ts`. Report engine (`reportEngine.ts`) bridges both.

7. **`financialConfig` vs individual params.** `FinancialConfig` is defined in `models/engineering.ts` and used in `CalcInput`. But many engine functions accept `indirectCosts`, `adminCosts`, `personalCosts` individually. Don't confuse the two forms.

---

## Budget Engine v4 (`src/engine/budgetEngine.ts`)

**Core exports:**
- `calculateProject(lines, options)` — full project cost with indirects/administrative/personals
- `calculateTree(lines, mm?)` — tree walk → `{ lines: LineCalcResult[], totals: BudgetTotals }`
- `calcLine(line, marketMultipliers?)` — single line calculation
- `calcDynamicQty(line)` — dimension-based quantity
- `calcSteelReinforcement(line, qty)` — steel bar estimation
- `analyzeSensitivity(lines, scenarios, options?)` — multi-scenario what-if
- `checkDeviations(lines, actualCosts, threshold?)` — budget-vs-actual alerts
- `generateBOM(lines)` — bill of materials
- `calculateSchedule(lines)` — timeline estimate
- `fmtQty`, `fmtMoney` (= `fmtQ`), `parseQtyInput`, `validateQty`
- `PMath` — precision math namespace

**Backward-compat aliases** (all deprecated):
- `calculateFullProject` = `calculateProject`
- `calculateBudget` = `calculateProject`
- `calculateBudgetTree` = `calculateTree`
- `calculateSensitivity` = `analyzeSensitivity`
- `LineResult` = `LineCalcResult`
- `ProjectTotals` = `BudgetTotals`
- `BudgetLineResult` = `LineCalcResult`
- `DeviationAlert` = `Deviation`

**Key types** imported from `models/budget.ts`:
- `BudgetLineDocument` — full type with all legacy + new fields
- `LineCalcResult` — engine output per line
- `BudgetTotals` — project-level totals
- `Deviation`, `SensitivityScenario`, `MaterialSummary`

---

## Currency & Number Formatting

- **Currency:** Guatemalan Quetzal (GTQ), symbol `Q.`, 2 decimal places, thousand separator `,`
- **`fmtQ(n)`** in `src/utils/format.ts` — primary formatter: `"Q 1,234.56"`
- **`fmtQty(n)`** in `src/engine/precision.ts` — engine's formatter (same output, different path)
- **`fmtInput(n)`** — for input fields: `"1,234.56"` (no `Q.` prefix)
- **Never use `formatQ`** — it doesn't exist. Use `fmtQ`.

---

## Firestore Collections

Required collections (defined in `firestoreService.ts:REQUIRED_COLLECTIONS`):
`projects`, `clients`, `staff`, `suppliers`, `inventory`, `transactions`, `purchaseOrders`, `logs`

All queries filter by `ownerId`. `generateProjectStock()` auto-creates inventory items from budget materials when a project enters `EJECUCION` status.

---

## Report System (Two Generations)

**`src/lib/reportEngine.ts`** (new, unified) — exports all PDF generators and CSV/JSON:
- `generateBudgetPDF` — full 4+ page budget
- `generateBudgetPDFEjecutivo` — compact executive quote
- `generateBudgetPDFCliente` — client-facing summary
- `generateBudgetPDFAPU` — unit price analysis
- `generateProgressReport` — physical/financial progress
- `generateBudgetCSV`, `generateBudgetJSON`, `generateBOM`

**`src/lib/reports.ts`** (legacy, duplicate) — same functions but uses old `Project` type from `constants.ts`. Being phased out in favor of `reportEngine.ts`.

Both use `jspdf` + `jspdf-autotable`. Colors are hardcoded RGB tuples (corporate palette).

---

## Vite / Toolchain Quirks

- **`manualChunks`** in `vite.config.ts` is a regular function (not arrow) for Rollup 4 compatibility.
- **Path alias:** `@` maps to project root (`./*`). Configured in both `tsconfig.json` and `vite.config.ts`.
- **Tailwind v4** via `@tailwindcss/vite` plugin — uses `@import "tailwindcss"` in CSS, **not** `@tailwind` directives.
- **Motion** library: import from `'motion/react'`, not `'framer-motion'`.
- **Lucide icons:** individual imports from `'lucide-react'`.
- **HMR** can be disabled via `DISABLE_HMR=true` env var (used for AI studio stability).
- **API proxy:** dev server proxies `/api` → `http://localhost:3000`. Run `npx vercel dev` alongside for local API testing.
- **Environment:** `GEMINI_API_KEY` required for AI features, injected via `vite.config.ts` define.
- **No test framework** configured — no vitest, jest, cypress, or playwright.

---

## Settings Persistence

All settings persist to **both** `localStorage` (`app-visual-settings`) and Firestore (`userSettings/{uid}`) with 800ms debounce. On reconnect, settings auto-sync from Firestore.

---

## Common Import Paths

```ts
// Budget types
import { BudgetLineDocument, LineCalcResult, BudgetTotals } from '../models/budget';

// Engine
import { calculateProject, calculateTree, calcLine, ENGINEERING } from '../engine/budgetEngine';

// Legacy compat (used by old components)
import { BudgetLine, LineResult, ProjectTotals } from '../lib/budgetData';

// Formatting
import { fmtQ } from '../utils/format';

// Firebase
import { db, auth } from '../lib/firebase';

// Types from old constants
import { Project, Typology } from '../constants';
```