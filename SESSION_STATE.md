# SESSION STATE — ERP Constructora WM
# Saved: 2026-05-15T06:14:26 CST
# Purpose: Resume point for next session

---

## 1. PROGRESS MADE IN THIS SESSION

### 1.1 Full Codebase Audit (40+ files reviewed)
- Read and analyzed all core architecture files
- Identified the root cause of ERR_INTERNET_DISCONNECTED
- Mapped every module's current state (Dashboard, Execution, Clients, Inventory, Projects, Suppliers, Staff, Analytics, Seguimiento, Settings)
- Found duplicate style systems, legacy patterns, and inconsistent form handling

### 1.2 Root Cause Analysis — ERR_INTERNET_DISCONNECTED
**Finding:** The error cycle is NOT caused by a legacy Firebase v8 bundle. The `vendor-firebase-Dp3tJ8cQ.js` is Vite's `manualChunks` output of the **modular Firebase v12 SDK** — it's expected behavior.

**Actual root cause:** TWO competing connection managers run simultaneously:
1. `SyncEngine.ts` — registers its own `window.addEventListener('online'/'offline')` + heartbeat timer (30s interval) + `_onConnect`/`_onDisconnect` handlers
2. `RealtimeSync.ts` — registers SEPARATE `window.addEventListener('online'/'offline')` + its own reconnection logic + `handleOffline`/`handleOnline` functions

When connectivity fluctuates, both systems fire independently:
- SyncEngine detects offline → sets `this.online = false`
- RealtimeSync detects offline → sets `globalIsOffline = true`, unsubscribes all listeners
- SyncEngine heartbeat fires → sees "online" → calls `_onConnect()` → triggers sync
- RealtimeSync's `handleOnline` fires after delay → calls `syncAllCollections()` → starts listeners
- This creates a **reconnection storm** with rapid subscribe/unsubscribe cycles hitting Firestore's `/Listen/channel?VER=8` endpoints

### 1.3 Architecture Verified
- ✅ `firebase.ts` — Clean, fully modular SDK v9+ imports, no compat layer
- ✅ `vite.config.ts` — No legacy script references, clean manualChunks config
- ✅ `index.html` — No legacy CDN script tags
- ✅ `AuthContext.tsx` — Properly initializes SyncEngine + RealtimeSync on login
- ✅ `RealtimeSync.ts` — Strategy is correct (unsubscribe + flags + delayed reconnect) but conflicts with SyncEngine
- ✅ `SyncEngine.ts` — Vector clock conflict resolution works correctly, but its connection management is the problem
- ✅ `store.ts` (Dexie) — Correctly implemented offline-first cache
- ✅ `firestoreService.ts` — Clean modular SDK usage, proper offline queue

### 1.4 UI Component Audit
All `src/components/ui/*` components reviewed:
- `Button` (button.tsx) ✅ Well-implemented with CVA, loading states
- `Input` (input.tsx) ✅ Good, has label/error/hint/icon support
- `Card` (card.tsx) ✅ Good variants (default/glass/gradient/dark)
- `Modal` (Modal.tsx) ✅ Accessible, animated, proper overlay
- `Select` (select.tsx) ✅ Functional, has error states
- `Textarea` (textarea.tsx) ✅ Clean implementation
- `Badge` (badge.tsx) ✅ Good color variants
- `Avatar` (avatar.tsx) ✅ Fallback handling, ring styling
- `Tooltip` (tooltip.tsx) ✅ Manual implementation, no tippy.js dependency
- `ProgressBar` (progress.tsx) ✅ Animated, configurable
- `Skeleton` (skeleton.tsx) ✅ Multiple variants including card/table row
- `Separator` (separator.tsx) ✅ Simple, supports gradient
- `Sheet` (sheet.tsx) ✅ Animated with motion/react
- `DropdownMenu` (dropdown-menu.tsx) ✅ Full implementation with groups
- `Command` (command.tsx) ✅ K-shortcut support, animated
- `Pagination` (Pagination.tsx) ✅ Compact + full modes, grid-aware

### 1.5 Design System Assessed
- `src/index.css` — Tailwind v4 + CSS custom properties (`@theme`), well-structured with base/utilities/components/animations/themes layers
- `src/styles/tokens.ts` — Contains FEWER tokens than index.css, but has spacing/radii/shadows/transitions not in CSS
- Token duplication exists but is manageable — index.css is the visual source of truth, tokens.ts is the JS-accessible source
- Three themes defined: minimalist (default), cyberpunk, soft

### 1.6 Module Component Status
| Module | File | Lines | Status |
|--------|------|-------|--------|
| Dashboard | `components/modules/Dashboard/index.tsx` | Wrapper only, delegates to Dashboard | ✅ Needs Dashboard.tsx review |
| Dashboard Charts | `components/modules/Dashboard/Charts.tsx` | Read | ✅ Recharts-based, needs review |
| Dashboard KPIs | `components/modules/Dashboard/KpiCard.tsx` | Read | ✅ Needs minor updates |
| Execution | `components/Execution.tsx` | 514 lines | ⚠️ Inline form styles, no component library |
| Clients | `components/Clients.tsx` | 464 lines | ⚠️ Inline form modal, no component library |
| Inventory | `components/Inventory.tsx` | 1031+ lines | ⚠️ Large, inline modals, good functionality |
| Projects | `components/Projects.tsx` | 962+ lines | ⚠️ Large, inline modals, good features |
| Suppliers | `components/Suppliers.tsx` | 784+ lines | ⚠️ Inline form modals |
| Staff | `components/Staff.tsx` | 866+ lines | ⚠️ Inline form modals, payroll feature |
| Analytics | `components/Analytics.tsx` | 819+ lines | ⚠️ Good charts, inline styles |

---

## 2. PENDING TASKS (Next Session Starting Points)

### Priority: HIGH — ERR_INTERNET_DISCONNECTED Fix

**Task 2.1: Remove competing connection management from SyncEngine.ts**
- Remove `window.addEventListener('online', this._onConnect)` and `window.addEventListener('offline', this._onDisconnect)` from `SyncEngine.init()`
- Remove heartbeat timer (`_startHeartbeat`) from SyncEngine — RealtimeSync handles this
- SyncEngine should be "dumb" — only sync when explicitly called, not on network events
- Keep `checkOnline()` helper but make it static/utility
- Update `AuthContext.tsx` to not rely on SyncEngine for connection lifecycle

**Task 2.2: Strengthen RealtimeSync.ts as the single connection authority**
- Add reconnect debounce (prevent rapid reconnect attempts)
- Add `globalListenersActive` flag check before any subscribe attempt
- Add cooldown period after disconnect (minimum 5 seconds before reconnect attempt)
- Ensure `handleOnline` does NOT trigger if `globalShuttingDown` is still true
- Add `console.warn` for any attempt to start listeners while blocked

**Task 2.3: Update AuthContext.tsx for clean lifecycle**
- Use only RealtimeSync for connection management
- SyncEngine should only be used for manual sync operations (enqueue, push, pull)
- Ensure cleanup on logout properly destroys both systems

### Priority: MEDIUM — CSS/Design System Consolidation

**Task 2.4: Merge `src/styles/tokens.ts` into `src/index.css`**
- The `@theme` block in index.css already has most tokens
- Add missing tokens from tokens.ts (spacing extras: 14/20/24/32, specific shadows, transitions as CSS vars)
- Keep tokens.ts as a JS-readable export that reads from CSS custom properties at runtime, OR
- Keep both in sync with clearly documented mapping
- Remove any duplicate definitions

**Task 2.5: Standardize component library CSS**
- Ensure all `src/components/ui/*` components use design tokens from index.css
- Replace any hardcoded colors with CSS custom property references
- Add dark mode support to all components using the `.theme-cyberpunk` variables

### Priority: MEDIUM — Form & UX Improvements

**Task 2.6: Create shared form components**
- `FormField` — wrapper with label, hint, error message, required indicator
- `FormSelect` — enhanced select with search, icons, proper accessibility
- `FormDate` — date input with locale formatting
- `FormEditor` — rich text or markdown area
- All form components should use `react-hook-form` or similar for validation

**Task 2.7: Refactor module modals to use Modal component**
- Currently: Clients.tsx, Inventory.tsx, Projects.tsx, Suppliers.tsx, Staff.tsx all use inline `<motion.div>` overlays instead of the `<Modal>` component
- Replace all inline modals with the `<Modal>` component from `src/components/ui/Modal.tsx`
- Ensure forms inside modals have proper focus management and keyboard navigation

### Priority: LOW — Cleanup & Polish

**Task 2.8: Remove dead code**
- `src/lib/reports.ts` — Legacy duplicate report logic, schedule for removal
- `src/constants.ts` — Old types used by legacy code, migrate to `src/models/`
- `src/components/Layout.tsx` — Verify if this old layout still exists and remove
- Any commented-out code blocks across all components

**Task 2.9: Add accessibility improvements**
- ARIA labels on all interactive elements
- Skip navigation link
- Proper focus trapping in modals
- Screen reader announcements for toast notifications
- Color contrast verification (WCAG AA minimum)

**Task 2.10: Build verification**
- `npm run lint` — Fix any TypeScript errors
- `npm run build` — Verify production build succeeds
- Test offline/online transitions in browser devtools
- Verify no ERR_INTERNET_DISCONNECTED errors in console

---

## 3. KEY ARCHITECTURAL DECISIONS (This Session)

1. **Single connection authority**: RealtimeSync.ts is the ONLY module that manages Firestore listener lifecycle. SyncEngine handles queue-based sync operations only.

2. **No disableNetwork()/terminate()**: Confirmed these SDK methods activate internal retry timers that perpetuate errors. The solution is proper unsubscribe + flag-based blocking.

3. **CSS custom properties as source of truth**: `src/index.css` `@theme` block is the canonical design token location. `tokens.ts` is for JS-accessible token consumption.

4. **Component library over inline styles**: All new UI work should use `src/components/ui/*` components. Inline styles in module components should be replaced gradually.

5. **Motion/react for animations**: Confirmed as the animation library (not framer-motion directly).

---

## 4. FILES REQUIRING CHANGES (Next Session)

### Critical (ERR_INTERNET fix)
1. `src/lib/sync/SyncEngine.ts` — Remove connection lifecycle (lines 113-114, 128-139, 141-155, modify class to be sync-only)
2. `src/lib/sync/RealtimeSync.ts` — Add debounce, strengthen guards
3. `src/contexts/AuthContext.tsx` — Update to single connection manager

### Medium Priority
4. `src/styles/tokens.ts` — Align with index.css tokens
5. `src/index.css` — Add missing tokens from tokens.ts
6. `src/components/ui/button.tsx` — Minor: ensure dark mode compatibility
7. `src/components/ui/input.tsx` — Minor: add disabled styling consistency

### Cleanup
8. `src/components/Layout.tsx` — Verify existence and deprecate
9. `src/lib/reports.ts` — Mark for deprecation
10. `src/constants.ts` — Migrate to models/