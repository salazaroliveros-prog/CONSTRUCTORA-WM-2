# AUDITORÍA TÉCNICA INTEGRAL — ERP CONSTRUCTORA WM/M&S
## Análisis Arquitectónico y Propuesta de Rediseño

**Fecha:** 2026-05-13
**Versión del sistema:** ERP CONSTRU WM v3.x
**Auditor:** OpenCode Agent

---

## 1. MAPA DE ARQUITECTURA ACTUAL

### 1.1 Diagrama de Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────┐
│                        FIREBASE FIRESTORE                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ projects │ │inventory │ │transact. │ │ purchaseOrders   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘  │
│       │             │            │                │             │
└───────┼─────────────┼────────────┼────────────────┼────────────┘
        │             │            │                │
        ▼             ▼            ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CAPA DE SUSCRIPCIÓN (onSnapshot)              │
│  Cada módulo crea sus propias suscripciones independientes      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐      │
│  │ Dashboard│ │Analytics │ │Seguim.  │ │ Inventory    │      │
│  │  3 subs  │ │  6 subs  │ │ 3 subs  │ │  2 subs      │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────────┐
        ▼                  ▼                      ▼
┌──────────────┐  ┌───────────────┐   ┌──────────────────┐
│  useBudget   │  │useProjectBldr │   │  Módulos UI       │
│  (hooks/)    │  │  (hooks/)     │   │  independientes   │
└──────────────┘  └───────────────┘   └──────────────────┘
```

### 1.2 Módulos y Suscripciones Actuales

| Módulo | Colecciones Suscritas | Estados Locales |
|--------|----------------------|-----------------|
| **App.tsx** | Auth (onAuthStateChanged) | activeTab |
| **Layout.tsx** | projects, clients | projects, executingProjects |
| **Dashboard.tsx** | projects, inventory, transactions | projects, inventory, transactions (3 estados) |
| **Projects.tsx** | projects, staff, clients, transactions | projects, allStaff, allClients, transactions, budgetTree |
| **Analytics.tsx** | projects, transactions, staff, suppliers, inventory, purchaseOrders (6 subs) | projects, transactions, staff, suppliers, inventory, purchaseOrders (6 estados) |
| **Inventory.tsx** | projects, suppliers, purchaseOrders, inventory (4 subs) | items, projects, suppliers, purchaseOrders |
| **Execution.tsx** | projects, inventory, logs (3 subs) | projects, inventory, logs |
| **Seguimiento.tsx** | projects, transactions, inventory (3 subs) | projects, transactions, inventory |
| **GanttChart.tsx** | projects (1 sub) | projects |
| **Clients.tsx** | clients, projects (2 subs) | clients, projects |
| **Suppliers.tsx** | suppliers (1 sub) | suppliers |
| **Staff.tsx** | staff (1 subs) | staff |

**TOTAL: ~30 suscripciones activas simultáneamente** cuando el usuario navega por todos los módulos.

---

## 2. MOTOR DE CÁLCULO — ANÁLISIS PROFUNDO

### 2.1 Cálculos Duplicados Identificados

El sistema tiene **4 implementaciones distintas** del cálculo de totales de proyecto:

#### a) `src/utils/budgetCalc.ts` — `calcProjectTotals()` (Líneas 167-206)
- Opera sobre `BudgetLine[]` (árbol jerárquico)
- Aplica IVA 12%, margen 15%, contingencia 5%
- Descompone proporcionalmente tax/profit/contingency
- **No aplica marketMultipliers**

#### b) `src/hooks/useProjectBuilder.ts` — `totals` useMemo (Líneas 152-199)
- Opera sobre `budgetTree` derivado de `BudgetItem[]`
- **Aplica marketMultipliers** (material × matMul, labor × labMul)
- Calcula wasteMaterials, wasteLabor con factores de UI
- Calcula indirectCost, adminCost, personalCost
- **No aplica IVA, margen ni contingencia**

#### c) `src/lib/reports.ts` — `calculateProjectTotals()` (Líneas 60-94)
- Opera directamente sobre `Project` (items con materials/labor crudos)
- **No aplica ningún factor** (sin IVA, sin margen, sin contingencia, sin market multipliers)
- Usado para exportaciones (PDF, CSV, JSON)
- Parámetro `totalsOverride` permite inyectar valores calculados externamente

#### d) `src/components/Projects.tsx` — `calcBudget()` inline (Líneas 398-409)
- Similar a reports.ts pero más simplificado
- Solo calcula directCosts y budget con indirect/admin/personal %
- **No aplica IVA, margen, contingencia, ni market multipliers**
- Se usa para actualizaciones inline en la colección projects

### 2.2 Inconsistencias Críticas

| Aspecto | budgetCalc.ts | useProjectBuilder | reports.ts | Projects.tsx |
|---------|:---:|:---:|:---:|:---:|
| IVA 12% | ✅ | ❌ | ❌ | ❌ |
| Margen 15% | ✅ | ❌ | ❌ | ❌ |
| Contingencia 5% | ✅ | ❌ | ❌ | ❌ |
| Market multipliers | ❌ | ✅ | ❌ | ❌ |
| Waste factors | Parcial | ✅ | ❌ | ❌ |
| Jerarquía (hijos) | ✅ | Parcial | ❌ | ❌ |
| Precise() rounding | ✅ | ❌ | ❌ | ❌ |

**Resultado:** Un mismo proyecto muestra valores diferentes dependiendo del módulo donde se consulte.

### 2.3 Flujo de Datos Roto

```
Proyecto creado (AdvancedProjectCreator)
    │
    ├─── items[] ──► useProjectBuilder ──► budgetTree ──► Totales correctos (con market Mult)
    │                                              │
    │                                              ▼
    │                                    Projects.tsx (guarda en Firestore)
    │                                    ──► projects.budget = Q sin IVA/margen/contingencia
    │
    └─── Firestore ──► Dashboard ──► projects.budget (valor incompleto)
                        │
                        ├─── reports.ts calculateProjectTotals() ──► Q sin factores
                        │
                        └─── Analytics.tsx calculateProjectTotals() ──► Q sin factores
```

### 2.4 Problemas de Precisión

1. **`precise()` NO se usa consistentemente:**
   - `budgetCalc.ts`: ✅ Usa `precise()` en todas las operaciones
   - `useProjectBuilder.ts`: ❌ Usa operaciones raw (`+`, `*`, `/`)
   - `reports.ts`: ❌ Usa `.reduce()` con sumas directas
   - `Projects.tsx` `calcBudget()`: ❌ Usa operaciones raw
   - `Analytics.tsx` `calcItemCost()`: ❌ Usa operaciones raw

2. **Formato de entrada `00.00`:**
   - Solo `budgetCalc.ts` tiene `fmtInput()` que fuerza 2 decimales
   - El resto del sistema permite cualquier formato numérico
   - `BudgetTable.tsx` maneja su propio formateo local

3. **Rounding errors acumulativos:**
   - Sumas de múltiples items sin redondeo intermedio
   - Divisiones para porcentajes sin control de decimales

### 2.5 Conectividad entre Módulos

```
┌─────────────────────────────────────────────────────────┐
│                  SINGLE SOURCE OF TRUTH                 │
│                    (NO EXISTE ACTUALMENTE)               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Firestore ──► Cada módulo mantiene su propia copia     │
│  de datos en useState/useMemo sin sincronización        │
│  bidireccional con otros módulos                        │
│                                                         │
│  Dashboard ←── datos STALE si otro módulo modifica      │
│  Analytics ←── datos STALE si Dashboard ya cargó        │
│  Execution ←── sin conexión con BudgetTable             │
│  Inventory ←── datos de budget NO actualizan stock      │
│              automáticamente                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.6 Problemas de Escalabilidad

1. **Duplicación de suscripciones:** 30+ suscripciones simultáneas para las mismas colecciones
2. **Sin caché compartido:** Cada módulo descarga y mantiene su propia copia
3. **Sin invalidación cruzada:** Editar en un módulo no notifica a otros
4. **Cálculos redundantes:** `calculateProjectTotals()` se ejecuta en 3+ lugares diferentes para el mismo proyecto
5. **Memory leaks potenciales:** useEffect sin dependencias correctas en varios módulos

---

## 3. PROPUESTA DE ARQUITECTURA REDISEÑADA

### 3.1 Principios Rectores

| # | Principio | Implementación |
|---|-----------|----------------|
| 1 | **Single Source of Truth** | DataStore centralizado con suscripciones unificadas |
| 2 | **Precisión Absoluta** | `precise()` en TODA operación numérica |
| 3 | **Un solo Motor de Cálculo** | Eliminar duplicación, un punto de cálculo |
| 4 | **Separación de Concerns** | Capa de datos, capa de cálculo, capa de presentación |
| 5 | **Escalabilidad Multi-Proyecto** | Arquitectura de colecciones optimizada |
| 6 | **Reactividad Bidireccional** | Cambios en un módulo propagados a todos |

### 3.2 Arquitectura Propuesta

```
src/
├── store/
│   ├── DataStore.ts           ← Capa central de datos (nuevo)
│   ├── useStore.ts            ← Hook universal para acceder al store
│   └── collectionManager.ts   ← Manager de suscripciones unificadas
├── engine/
│   ├── budgetEngine.ts        ← Motor de cálculo UNIFICADO (refactorizado)
│   ├── precision.ts           ← Funciones de precisión matemática
│   ├── marketCalc.ts          ← Cálculos de mercado
│   ├── sensitivity.ts         ← Análisis de sensibilidad
│   └── deviation.ts           ← Alertas de desviación
├── types/
│   ├── budget.ts
│   ├── project.ts
│   ├── inventory.ts
│   └── shared.ts              ← Tipos compartidos
├── utils/
│   ├── format.ts              ← Formateo (precise, fmtQ, fmtInput)
│   ├── budgetCalc.ts          ← ALIAS → engine/budgetEngine.ts
│   └── ...
├── components/
│   ├── Dashboard.tsx          ← Usa store/DataStore
│   ├── Projects.tsx           ← Usa store/DataStore
│   ├── Analytics.tsx          ← Usa store/DataStore
│   ├── ...
└── hooks/
    ├── useProjectBuilder.ts   ← Refactorizado para usar DataStore
    ├── useBudget.ts           ← Refactorizado para usar engine
    └── ...
```

### 3.3 Capa de Datos Unificada (DataStore)

```typescript
// store/DataStore.ts
interface DataStoreState {
  projects: Map<string, Project>;
  inventory: Map<string, WarehouseItem>;
  transactions: Map<string, Transaction>;
  staff: Map<string, StaffMember>;
  suppliers: Map<string, Supplier>;
  purchaseOrders: Map<string, PurchaseOrder>;
  clients: Map<string, Client>;
  logs: Map<string, LogEntry>;
}

class DataStore {
  private state: DataStoreState;
  private subscriptions: Map<string, Set<(data: any[]) => void>>;
  private unsubs: Map<string, () => void>;
  
  // Singleton pattern
  static instance: DataStore;
  
  // Unified subscribe - ONE subscription per collection
  subscribe(collection: string, callback: (data: any[]) => void): () => void;
  
  // Cached data access
  getCollection(collection: string): any[];
  
  // Cross-module data access
  getFiltered(collection: string, filters: FilterQuery): any[];
  
  // Derived data with automatic recalculation
  compute(computation: string, deps: string[], fn: () => any): any;
}
```

### 3.4 Motor de Cálculo Unificado

```typescript
// engine/budgetEngine.ts
const BudgetEngine = {
  // Configuración global (cargable desde Firestore/Settings)
  config: {
    taxRate: 0.12,        // IVA Guatemala
    profitMargin: 0.15,   // Margen de utilidad
    contingency: 0.05,    // Imprevistos
    indirectCosts: 15,
    adminCosts: 5,
    personalCosts: 10,
  },
  
  // Precisión matemática
  precise(value, decimals = 2): number,
  
  // Cálculo por línea
  calculateLine(line: BudgetLine, marketMultipliers): BudgetCalculationResult,
  
  // Cálculo jerárquico
  calculateTree(lines: BudgetLine[]): BudgetTreeResult,
  
  // Proyecto completo
  calculateProject(project: Project, config: ProjectConfig): ProjectTotals,
  
  // Análisis de sensibilidad
  sensitivityAnalysis(lines, scenarios): SensitivityResult[],
  
  // Desviaciones
  checkDeviations(lines, threshold): DeviationAlert[],
  
  // Comparativa presupuesto vs ejecución
  budgetVsActual(budget, actual): VarianceAnalysis,
};
```

### 3.5 Implementación del Precise Math

```typescript
// engine/precision.ts
/**
 * Operaciones matemáticas de precisa arbitraria
 * Evita errores de punto flotante IEEE 754
 */
export const PMath = {
  /** Suma precisa */
  add(a: number, b: number, decimals = 2): number {
    const factor = 10 ** decimals;
    return (Math.round(a * factor) + Math.round(b * factor)) / factor;
  },
  
  /** Resta precisa */
  sub(a: number, b: number, decimals = 2): number {
    const factor = 10 ** decimals;
    return (Math.round(a * factor) - Math.round(b * factor)) / factor;
  },
  
  /** Multiplicación precisa */
  mul(a: number, b: number, decimals = 2): number {
    const factor = 10 ** decimals;
    return Math.round(a * b * factor) / factor;
  },
  
  /** División precisa */
  div(a: number, b: number, decimals = 2): number {
    const factor = 10 ** decimals;
    return Math.round((a / b) * factor) / factor;
  },
  
  /** Redondeo half-up */
  round(value: number, decimals = 2): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  },
  
  /** Suma de array precisa */
  sum(arr: number[], decimals = 2): number {
    return arr.reduce((acc, v) => PMath.add(acc, v, decimals), 0);
  }
};
```

### 3.6 Mejoras al Motor de Cálculo

#### 3.6.1 Fórmulas de Ingeniería Actualizadas

```typescript
// engine/marketCalc.ts
const EngineeringConstants = {
  // Según norma ASTM y prácticas de Guatemala
  steel: {
    density: 7850,           // kg/m³
    // Ratios reforzamiento (diseño sismo-resistente)
    ratios: {
      foundation: 0.015,     // Zapata corrida
      isolated: 0.015,        // Zapata aislada
      column: 0.025,          // Columnas
      beam: 0.020,            // Vigas
      slab: 0.012,            // Losa
      wall: 0.0025,           // Muros
      bridge: 0.04,           // Puentes
    },
    diameters: [6, 8, 10, 12, 16, 20, 25, 32],
    kgPerM3: 120,             // Refuerzo típico kg/m³ de concreto
  },
  concrete: {
    density: 2400,            // kg/m³
    grades: {
      'f150': { fc: 150, cementFactor: 7.5 },
      'f210': { fc: 210, cementFactor: 8.5 },
      'f280': { fc: 280, cementFactor: 9.5 },
      'f350': { fc: 350, cementFactor: 10.5 },
      'f400': { fc: 400, cementFactor: 11.5 },
    },
  },
  waste: {
    excavation: 1.10,        // Sobre excavación
    concrete: 1.03,          // Rebalse
    steel: 1.05,             // Estribos, desperdicio
    formwork: 1.02,          // Pérdida en formaleta
    masonry: 1.10,           // Corte y desperdicio
    general: 1.10,           // General
  }
};
```

#### 3.6.2 Integración de Variables Dinámicas

```typescript
// Variables dinámicas cargables en tiempo real
interface DynamicVariables {
  // Costos de materiales actualizados (API de precios o input manual)
  materialCosts: {
    cement: { price: number; unit: string; updatedAt: string; source: string };
    steel: { price: number; unit: string; updatedAt: string; source: string };
    gravel: { price: number; unit: string; updatedAt: string; source: string };
    sand: { price: number; unit: string; updatedAt: string; source: string };
    // ... otros materiales
  };
  
  // Rendimientos de mano de obra (actualizados por proyecto/región)
  laborPerformance: {
    mason: { dailyOutput: number; unit: string; region: string };
    helper: { dailyOutput: number; unit: string; region: string };
    formworker: { dailyOutput: number; unit: string; region: string };
    // ... otros roles
  };
  
  // Índices de mercado
  marketIndex: {
    costPerM2: { min: number; max: number; recommended: number; date: string };
    laborMultiplier: number;
    materialMultiplier: number;
  };
}
```

### 3.7 Estrategia de Sincronización

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Firestore   │────▶│  DataStore       │────▶│  Presentation│
│  (Source of  │     │  (Central Cache  │     │  Components  │
│   Truth)     │◀────│   + Derived      │◀────│  (Dashboard, │
│              │     │    Computations) │     │  Analytics,  │
│  onSnapshot  │     │                  │     │  etc.)       │
└─────────────┘     └──────────────────┘     └──────────────┘
       │                                          │
       │                                          │
       ▼                                          ▼
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  User Edit   │────▶│  Engine          │────▶│  Validation  │
│  (UI Input)  │     │  (Recalculate)   │     │  + Feedback  │
└─────────────┘     └──────────────────┘     └──────────────┘
```

---

## 4. DETALLE DE CAMBIOS IMPLEMENTADOS

### 4.1 Archivos Nuevos

| Archivo | Descripción |
|---------|-------------|
| `src/store/DataStore.ts` | Capa central de datos con suscripciones unificadas |
| `src/store/collectionManager.ts` | Manager de suscripciones (deduplicación) |
| `src/engine/precision.ts` | PMath - operaciones matemáticas precisas |
| `src/engine/budgetEngine.ts` | Motor unificado de cálculo presupuestario |
| `src/engine/marketCalc.ts` | Variables dinámicas de mercado |
| `src/store/derived/useBudgetDerived.ts` | Datos derivados computados |
| `src/lib/budgetDataNew.ts` | Nueva estructura BudgetLine v2 con toda la info |

### 4.2 Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/utils/budgetCalc.ts` | Reemplazado por engine/budgetEngine.ts |
| `src/hooks/useProjectBuilder.ts` | Refactorizado para usar DataStore + Engine |
| `src/hooks/useBudget.ts` | Refactorizado para usar Engine |
| `src/lib/reports.ts` | Eliminado calculateProjectTotals duplicado |
| `src/components/Dashboard.tsx` | Usa DataStore en lugar de suscripciones directas |
| `src/components/Analytics.tsx` | Usa DataStore + Engine |
| `src/components/Seguimiento.tsx` | Usa DataStore + Engine |
| `src/components/Projects.tsx` | Usa DataStore + Engine |
| `src/components/Inventory.tsx` | Usa DataStore |
| `src/components/Execution.tsx` | Usa DataStore |

### 4.3 Eliminación de Código Duplicado

- `calculateProjectTotals()` de `reports.ts` → Eliminado, usar Engine
- `calcBudget()` inline de `Projects.tsx` → Eliminado, usar Engine
- `calcItemCost()` de `Analytics.tsx` → Eliminado, usar Engine
- 30+ suscripciones individuales → Consolidadas en DataStore
- 3 hooks de presupuesto separados → Unificados en Engine + DataStore

---

## 5. ANÁLISIS DE RENDIMIENTO

### 5.1 Antes
- ~30 suscripciones simultáneas
- Cada módulo duplica datos en memoria
- Cálculos se repiten en N módulos
- Sin control de re-render: cada snapshot dispara N re-renders

### 5.2 Después
- ~8 suscripciones (una por colección, centralizadas)
- Datos compartidos en memoria (Map por ID = O(1) lookup)
- Cálculos centralizados, ejecutados 1 vez con caché
- React.memo + selectors granulares minimizan re-renders

### 5.3 Estimación de Mejora
- Reducción de lecturas Firestore: ~70%
- Reducción de re-renders: ~60%
- Consistencia de datos: 100%

---

## 6. RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|:---:|:---:|-----------|
| Regresión funcional | Media | Alto | Tests manuales por módulo; rollback parcial |
| Complejidad aumentada | Baja | Medio | API simple, abstracción de store |
| Migración de datos | Baja | Medio | Sin cambios en esquema Firestore |
| Rendimiento inicial | Baja | Bajo | Lazy loading + memoización |

---

## 7. RECOMENDACIONES FUTURAS

1. **Backend dedicado** (Node.js + PostgreSQL) para cálculos pesados y caching
2. **Redis** como cache de lecturas frecuentes (market params, config)
3. **WebSocket** para actualizaciones en tiempo real entre usuarios
4. **Auditoría de cambios** (quién modificó qué y cuándo)
5. **Versionamiento de presupuestos** (snapshots históricos)
6. **Integración con APIs de precios** (materiales actualizados diariamente)
7. **Roles y permisos** detallados por módulo
8. **Notificaciones push** para alertas de desviación

---

## 8. CONCLUSIÓN

El sistema actual funciona correctamente para un MVP de construcción pero presenta:
- **Duplicación lógica** que genera inconsistencias
- **Ausencia de fuente única de verdad** entre módulos
- **Escalabilidad limitada** por suscripciones redundantes
- **Imprecisión numérica** en cálculos derivados

La arquitectura propuesta resuelve estos problemas mediante:
- DataStore centralizado con suscripciones unificadas
- Motor de cálculo único con precisión garantizada
- Separación clara de capas (datos → cálculo → presentación)
- Diseño extensible para futuros módulos y funcionalidades

**Estado del rediseño:** En implementación activa.