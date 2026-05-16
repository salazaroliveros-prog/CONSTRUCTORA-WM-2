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
- **PWA:** Service worker at `/public/sw.js`, registered in `src/main.tsx`. Cache de assets estáticos (sin offline-first).
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
| *(eliminado)* | Offline sync removido — la app es 100% online con Firestore en tiempo real |
| `src/store/DataStore.ts` | Centralized DataStore with real-time subscriptions |
| `src/utils/budgetConverter.ts` | Bidirectional converters: `BudgetItem` ↔ `BudgetLine` |
| `middleware.ts` | Vercel Edge middleware — security headers only, never blocks `/api/*` |

---

## Sync / Offline-First (eliminado)

El sistema offline-first (Dexie.js, SyncEngine, RealtimeSync) fue eliminado. La app funciona 100% online con Firestore en tiempo real. El login persiste vía `browserLocalPersistence` (localStorage).

---

## Type System (Unified — `src/models/` is the single source of truth)

> La migración del sistema de tipos duales está **completa** (2026-05-16). Todos los tipos de dominio viven `src/models/`. `src/constants.ts` es un hub de re-exportación que mantiene compatibilidad con imports legacy.

### Archivos de modelo

| Archivo | Tipos |
|---|---|
| `src/models/engineering.ts` | `Typology` (enum), `ProjectStatus`, `FinancialConfig`, `EngineeringConstants`, `Dimensions`, `ComputationType`, `TopographyParams` |
| `src/models/project.ts` | `ProjectDocument`, `Project`, `ProjectItem`, `ProjectSummary`, `CreateProjectInput` |
| `src/models/client.ts` | `ClientDocument`, `Client` (legacy), `TerrainData`, `ClientSummary`, `EmergencyContact` |
| `src/models/budget.ts` | `BudgetLineDocument`, `LineCalcResult`, `BudgetTotals`, `ScheduleEstimate`, `Deviation`, `CalcInput`, `CalcOutput` |
| `src/models/workItem.ts` | `Material`, `Labor`, `WorkItem` |
| `src/models/staff.ts` | `StaffMember` |
| `src/models/transaction.ts` | `Transaction` |
| `src/models/warehouse.ts` | `WarehouseItem`, `WarehouseMovement` |
| `src/models/payroll.ts` | `Payroll`, `PayrollEmployee` |
| `src/models/purchaseOrder.ts` | `PurchaseOrder`, `PurchaseOrderItem` |
| `src/models/supplier.ts` | `Supplier` |
| `src/models/log.ts` | `LogEntry` |

### Import paths (mantenidos para compatibilidad)

```ts
// ✅ Preferido — importar del barrel de modelos:
import { Project, StaffMember, Client, Typology } from '../models';

// ✅ Legacy — sigue funcionando (re-exportado desde constants.ts):
import { Project, StaffMember, Client, Typology } from '../constants';

// ⚠️ BudgetLine es type alias → usar BudgetLineDocument:
import { BudgetLineDocument } from '../models/budget';
```

## TypeScript — Critical Gotchas

1. **`BudgetLine` type alias.** `src/models/budget.ts` — `export type BudgetLine = BudgetLineDocument`. Alias exists for backward compat in `constants.ts`. Use `BudgetLineDocument` for construction.

2. **`Project.status` is a literal union, not `string`:**
   ```ts
   type ProjectStatus = 'COTIZACION' | 'EJECUCION' | 'FINALIZADO' | 'PAUSADO';
   ```
   Spreading a Firestore doc (`...project`) produces `status: string`, breaking type checks. Use `as any` on PDF calls in `reportEngine.ts`.

3. **Typology enum is UNIFIED** — defined once in `models/engineering.ts`. Both `constants.ts` and `models/index.ts` re-export the same enum. No more duplicate declarations.

4. **`ENGINEERING` constant** in `budgetEngine.ts` lacks `as const`. Types come from explicit cast (`as SteelRatios`). Do not add `as const` or steel ratio assignments will break.

5. **`budgetDataRaw.ts` circular import risk** — uses `import { BudgetLineDocument } from '../models/budget'` for type+value. If `models/budget.ts` ever re-exports something importing `budgetDataRaw`, it circulars. Keep the import type-only where possible.

6. **`Project` (legacy) vs `ProjectDocument` (new).** Both coexist in `models/project.ts`. Legacy has `items: ProjectItem[]`, `marketLevel`, `slabType`, `area` + from `constants.ts` re-export. Report engine (`reportEngine.ts`) bridges both.

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

---

## Recent Improvements (2026-05-15)

### 5. Headers COOP + CORS — corrección de errores de navegador
- **vercel.json**: Agregados `Cross-Origin-Opener-Policy: same-origin-allow-popups`, `Cross-Origin-Embedder-Policy: unsafe-none`, y headers CORS globales + específicos para `/api/*`
- **middleware.ts**: Agregados headers COOP, COEP, y CORS con origin dinámico para rutas API
- **api/auth/session.ts**: CORS dinámico con `ALLOWED_ORIGINS` array (vercel.app + localhost:5173/3000), `Access-Control-Allow-Credentials: true`, y cookie con Domain para cross-subdomain

### 6. Service Worker v12 → v14 — simplificado a cache-only
- Eliminadas las estrategias offline-first (networkFirstWithFallback, networkFirstOrFallback)
- El SW ahora solo cachea assets estáticos con stale-while-revalidate
- La app es 100% online; sin lógica offline en el SW

### 7. CSS cleanup — eliminado duplicado `.skeleton`
 - Eliminada definición duplicada de `.skeleton` (existía dos veces con diferentes estilos)
 - Consolidado en una sola definición con `@keyframes skeletonWave`
 - Mantenido estilo light/dark via herencia de variables CSS

### 8. Offline sync system removed
 - Eliminado `src/lib/sync/` completo (RealtimeSync.ts, SyncEngine.ts, store.ts, types.ts)
 - Eliminada dependencia Dexie.js (IndexedDB offline storage)
 - AuthContext simplificado: ya no inicia SyncEngine ni RealtimeSync
 - Firebase network control helpers (disableFirestoreNetwork/enableFirestoreNetwork) removidos
 - firestoreService.ts: writeWithOfflineQueue simplificado a escritura directa, isRetryableError eliminado
 - SyncStatus.tsx simplificado a indicador "En línea" estático
 - firestoreValidation.test.ts: tests offline/Dexie/SyncEngine eliminados

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

### 3. writeWithOfflineQueue removida (ya no hay offline)

La función `writeWithOfflineQueue` ahora escribe directamente en Firestore sin encolar. Las referencias a SyncEngine/Dexie fueron eliminadas.

### 4. Funciones dedicadas para `userSettings`
- `loadUserSettings(uid)` — carga configuración sin importar `firebase/firestore` en el componente.
- `saveUserSettings(uid, data)` — guarda configuración con `sanitize()` y `merge: true`.
- Siguen el mismo patrón que `addDocument`/`updateDocument` para el resto de colecciones.

---

## Recent Improvements (2026-05-17)

### 1. Offline-First System v2 — localStorage-based (reemplaza Dexie.js eliminado)
- **`src/services/cacheService.ts`**: Cache de lectura en localStorage para datos de Firestore. `cacheCollection()` guarda datos con timestamp, `getCachedCollection()` recupera en modo offline. Prefijo `app_cache_v1_`.
- **`src/services/offlineQueue.ts`**: Cola de escritura offline. `addToQueue()` encola creates/updates/deletes con UUID, `getQueue()` lista pendientes, `removeFromQueue()` limpia tras sincronizar. Prefijo `app_offline_queue_v1`.
- **`src/services/firestoreService.ts`**: Integración completa de cache + queue:
  - `getDocumentsForCollection()`: intenta Firestore primero, si falla sirve cache. Cachea automáticamente en éxito.
  - `addDocument()`/`updateDocument()`/`deleteDocument()`: detectan `navigator.onLine`, si offline → encolan operación + actualizan cache local inmediatamente (UI responde al instante). En online ejecutan Firestore directo.
  - Generan UUID cliente para creates offline y usan `POST ?documentId=` para ID predecible (sin mapeo de IDs al sincronizar).
  - `processPendingQueue()`: procesa cola FIFO al reconectar. Maneja `EJECUCION→generateProjectStock`, reintentos hasta 5, descarta si excede.
- **`src/contexts/NetworkStatusContext.tsx`**: Heartbeat cada 30s contra Firestore REST API (HEAD), dispara `triggerSync()` automático al reconectar. Expone `syncStatus` (pending, lastSync, syncing) para UI.
- **`src/store/DataStore.ts`**: Siembra stores desde cache en init (instantáneo incluso offline). Luego suscripciones Firestore reemplazan con datos frescos cuando hay conexión.

### 2. Analytics — Datos fantasma eliminados
- `totalIngresos`/`totalGastos` ahora requieren `hasProjects=true` y solo cuentan transacciones con `projectId` existente. Sin proyectos → Q0.
- `criticalInventory`, `pendingOrders`, `supplierAnalysis` usan mismo guard. Lint+build OK.

### 3. Navegación Móvil — Hamburguesa + Bottom Sheet funcional
- **TopBar**: Nuevo botón hamburguesa `<Menu />` visible en `<lg`. Prop `onToggleMobile`.
- **MobileNav**: `isOpen` ahora stateful (antes hardcodeado `false`). Toggle desde hamburguesa o botón flotante.
- **OfflineBanner**: Muestra "sincronizando…" durante sync, y contador de cambios pendientes offline.

### 4. Responsive Design v3 — Layout adaptativo
- **AppShell**: Sidebar `hidden lg:flex`, mobileNav `lg:hidden`, header `h-14 sm:h-16`.
- **TopBar**: Search oculto en `<lg` con botón de búsqueda alternativo. Reloj/divisores/fullscreen ocultos en `<sm`. Breadcrumbs ocultos en `<md`.
- **Sidebar**: Colapsable en desktop con animación `width: 64 ↔ 248`.
- **Tablas**: `table-wrap` con overflow-x-auto, `table-compact` para denso.
- **Grids**: Cards stack vertical en mobile, multidireccional en tablet/desktop con media queries.

## Recent Improvements (2026-05-18)

### 1. Tipologías expandidas a ~40 renglones c/u
- **COMERCIAL**: 37 renglones (era 3) — preliminares, cimentación industrial, estructura metálica, fachada muro cortina, instalaciones especializadas (CCTV, ascensor, A/C), acabados comerciales
- **INDUSTRIAL**: 37 renglones (era 3) — cimentación pesada, losa industrial, estructura metálica soldada, instalaciones contra incendios/compressed air, acabados industriales
- **CIVIL**: 37 renglones (era 3) — movimiento de tierras con bulldozer, pavimentos asfálticos, puentes/cajones, señalización vial, obras de drenaje
- **PÚBLICA**: 39 renglones (era 2) — aulas escolares, centros de salud, obras exteriores, instalaciones accesibles, mobiliario urbano

### 2. Reportes PDF — Eslogan, NIT y contacto de empresa
- **Slogan "Edificando el Futuro"** agregado a headers, footers y bloques de firma
- **NIT, email, teléfono, dirección** ahora aparecen en footer de todos los PDFs
- Datos de contacto se leen de `localStorage('app-visual-settings')` — configurables desde Ajustes
- Función `getCompanyInfo()` en `reportEngine.ts` con defaults

### 3. Configuración de Contacto en Ajustes
- SettingsContext: nuevos campos `companyNIT`, `companyEmail`, `companyPhone`, `companyAddress` con valores por defecto
- Settings.tsx: inputs para NIT, correo, teléfono, dirección en sección "Empresa"
- Persisten igual que el resto de settings (localStorage + Firestore)

### 4. Botón "Inicio" en cada pantalla
- Layout.tsx: botón ⌂ visible en todas las pantallas excepto Dashboard
- Navega a `setActiveTab('dashboard')` — siempre vuelve al panel principal

### 5. Columna "Pendiente de Aportar" en Seguimiento
- Seguimiento.tsx: panel "Resumen Financiero" en vista de proyecto seleccionado
- Muestra: Presupuesto, Aportado (txIncome), Ejecutado (txExpense), Pendiente = Presupuesto − Aportado
- Color ámbar si hay saldo pendiente, verde si está cubierto

### 6. Dimensiones estructurales — Verificación
- `DimensionEditor.tsx` ya detecta cimentación, columnas, soleras, zapatas por descripción
- `calcDynamicQty()` calcula volumen (l×w×h) para cimentación, columnas, soleras, zapatas
- `calcSteelReinforcement()` calcula acero automático según ratio de tipología
- No requirió cambios — la funcionalidad ya estaba completa

---

## Recent Improvements (2026-05-16)

### 1. Budget Engine — Cálculos corregidos de tax/waste/conttingency
- **Tax/Profit/Contingency bug:** `ENGINEERING.taxRate = 0.12` (decimal = 12%). Antes `calcLine` dividía por 100 → `0.12/100 = 0.0012` (0.12%). Corregido: eliminar `/100`.
- **Waste duplicado:** Se aplicaba en `calcDynamicQty` Y en `calcLine` → 6.09% efectivo. Corregido: waste solo en calcLine, por material.
- **Waste aplicado a labor/equipment:** Antes waste aplicaba a todo (material+labor+equipment). Corregido: solo a materiales.
- **Fallback legacy:** Si `materials[]` vacío, usa `materialCost`/`laborCost`/`equipmentCost` directos.
- **calculateSchedule:** Ahora usa `calcDynamicQty` en vez de `projectQuantity` para cantidad correcta.

### 2. Budget Table & Dimension Editor — UI fixes
- **WasteFactor display:** `wasteFactor = 1.03` mostraba "103%" → ahora muestra "3%" (correcto).
- **DimensionEditor preview:** Actualizado para ser consistente con `calcLine` (per-material waste).

### 3. Build Errors Corregidos
- **Dashboard.tsx:** `<motion.div>` cerrado con `</div>` → corregido a `</motion.div>`.
- **index.css:** `@layer components` sin `}` de cierre → agregado cierre.
- **ProjectBuilder.tsx:** Import de `reports.ts` (eliminado) → `reportEngine.ts`. Parámetros actualizados a nueva firma `(project, budgetTree, override)`.

### 4. Config Updates
- **.gitignore:** Agregado `*.bak` para archivos de backup.
- **sw.js:** Actualizado a v13 para cache invalidación.
- **services/**: Agregados a `.gitignore` los symlinks de skills (artefactos de agente).