# ERP Constructora WM — Esquema Lógico de Arquitectura

> Documento formal de interconexión de módulos, flujo de datos, esquema de base de datos e integridad referencial.
> Generado: 2026-05-16 | Última actualización: 2026-05-16

---

## 1. Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FIRESTORE (Google Cloud)                         │
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ projects  │ │ clients  │ │  staff   │ │suppliers │ │  inventory   │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬────┘ └──────┬───────┘ │
│  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌─────┴────┐ ┌──────┴───────┐ │
│  │transact. │ │purchOrders│ │   logs   │ │ payrolls │ │ userSettings │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
          ▲  REST/API (fetch)                      ▲  REST/API
          │                                         │
┌─────────┴─────────────────────────────────────────┴─────────┐
│         firestoreService.ts (CRUD + Cache + Cascade)          │
│  ┌────────────────┐  ┌────────────────────┐  ┌────────────┐  │
│  │ cacheService    │  │  offlineQueue      │  │cascadeDelete│  │
│  │ (localStorage)  │  │  (localStorage)    │  │  Project   │  │
│  └────────────────┘  └────────────────────┘  └────────────┘  │
└─────────────────────────┬─────────────────────────────────────┘
                          │
               ┌──────────┴──────────┐
               │    DataStore.ts     │  ← Única fuente de verdad
               │  (9 collection      │     polling cada 30s
               │   stores)           │     con fallback a cache
               └──────────┬──────────┘
                          │
          ┌───────────────┼────────────────────────────┐
          │               │                            │
  ┌───────┴───────┐ ┌─────┴──────┐          ┌─────────┴─────────┐
  │   useStore()  │ │ useStore() │          │ AILegacy (read-   │
  │               │ │            │          │ only, mantiene     │
  │ Clients       │ │ Dashboard  │          │ subscribe propio)  │
  │ Seguimiento   │ │ Execution  │          │                   │
  │ Analytics     │ │ Layout     │          │ AIAssistant       │
  │ PhFinDashboard│ │ GanttChart │          │ AIFloatingButton  │
  │ Staff         │ │            │          │ ProjectBuilder    │
  │ Suppliers     │ │            │          │                   │
  │ Inventory     │ │            │          │                   │
  │ Projects      │ │            │          │                   │
  └───────────────┘ └────────────┘          └───────────────────┘
```

---

## 2. Mapa de Módulos a Colecciones

| Módulo | Archivo | Lectura | Escritura | Patrón de Acceso |
|--------|---------|---------|-----------|-----------------|
| **Dashboard** | `src/components/Dashboard.tsx` | projects, transactions, inventory, staff, suppliers, clients | transactions, projects, clients, staff, suppliers, purchaseOrders, logs, inventory | **DataStore** (lectura), **firestoreService directo** (escritura) |
| **Clients** | `src/components/Clients.tsx` | clients, projects | clients | **DataStore** |
| **Projects** | `src/components/Projects.tsx` | projects, staff, clients, transactions | projects | **DataStore** |
| **Execution** | `src/components/Execution.tsx` | projects, logs, inventory | logs, projects | **DataStore** |
| **Staff** | `src/components/Staff.tsx` | staff, projects, payrolls | staff, payrolls, transactions, projects | **DataStore** |
| **Suppliers** | `src/components/Suppliers.tsx` | suppliers, purchaseOrders, inventory, projects | suppliers | **DataStore** |
| **Inventory** | `src/components/Inventory.tsx` | inventory, projects, suppliers, purchaseOrders | inventory, purchaseOrders, transactions | **DataStore** |
| **Seguimiento** | `src/components/Seguimiento.tsx` | projects, transactions, inventory | — (read-only) | **DataStore** |
| **Analytics** | `src/components/Analytics.tsx` | projects, transactions, inventory | — (read-only) | **DataStore** |
| **Settings** | `src/components/Settings.tsx` | userSettings | userSettings | SettingsContext |
| **GanttChart** | `src/components/GanttChart.tsx` | projects | projects | **DataStore** |
| **AIAssistant** | `src/components/AIAssistant.tsx` | all 8 collections | — (read-only) | **subscribeToCollection directo** |
| **AIFloatingButton** | `src/components/AIFloatingButton.tsx` | all 8 collections | — (read-only) | **subscribeToCollection directo** |
| **Layout** | `src/components/Layout.tsx` | projects, clients | — (read-only) | **DataStore** |
| **ProjectBuilder** | `src/components/AdvancedProjectCreator/` | clients, suppliers | projects | **subscribeToCollection directo** |
| **PhysicalFinancialDashboard** | `src/components/modules/` | projects, transactions | — (read-only) | **DataStore** |

---

## 3. Esquema de Colecciones Firestore

### 3.1 `projects`
```
ProjectDocument {
  id:                  string (Firestore ID)
  name:                string
  clientId:            string              → FK a clients.id
  clientName:          string
  terrainDataId?:      string
  typology:            "RESIDENCIAL"|"COMERCIAL"|"INDUSTRIAL"|"CIVIL"|"PUBLICA"
  status:              "COTIZACION"|"EJECUCION"|"FINALIZADO"|"PAUSADO"
  areaTerreno:         number
  areaConstruccion:    number
  numNiveles:          number
  budgetTree:          BudgetLineDocument[]   ← árbol anidado de renglones
  financialConfig:     FinancialConfig
  cachedResults?:      { totalBudget, directCost, costPerM2, estimatedDays, ... }
  startDate?:          string
  endDate?:            string
  progress:            number               // 0-100
  location?:           string
  teamIds?:            string[]             → FK a staff[]
  attachments?:        string[]
  ganttConfig?:        Record<string,any>
  notes?:              string
  ownerId:             string               → FK a Firebase Auth UID
  createdAt?:          string (ISO)
  updatedAt?:          string (ISO)
}
```

### 3.2 `clients`
```
ClientDocument {
  id:                string
  name:              string
  email:             string
  phone:             string
  address:           string
  nit:               string
  tipoPersona:       "PERSONA"|"EMPRESA"
  estado:            "ACTIVO"|"INACTIVO"
  proyectosIds:      string[]           ← FK inversa a projects[]
  totalProyectos:    number
  totalFacturado:    number
  contactoEmergencia?: { nombre, telefono, parentesco }
  documentos?:       { tipo, numero, fechaVencimiento, url }[]
  ownerId:           string             → Firebase Auth UID
  createdAt?:        string (ISO)
  updatedAt?:        string (ISO)
}
```

### 3.3 `staff`
```
StaffMember {
  id:             string
  name:           string
  role:           string
  salary:         number
  documentId:     string
  email?:         string
  phone?:         string
  status:         "Activo"|"Inactivo"
  address?:       string
  hireDate?:      string
  projectIds?:    string[]             → FK a projects[]
  notes?:         string
  bankName?:      string
  accountNumber?: string
  documents?:     { name, url, type }[]
}
```

### 3.4 `suppliers`
```
Supplier {
  id:         string
  name:       string
  contact:    string
  email:      string
  phone:      string
  address:    string
  nit?:       string
  status:     "ACTIVO"|"INACTIVO"
  rating?:    number
  projects?:  string[]
  createdAt?: string
}
```

### 3.5 `inventory`
```
WarehouseItem {
  id:             string
  name:           string
  cat:            "Materiales"|"Herramientas"|"EPP"
  stock:          number
  unit:           string
  location:       string
  minStock:       number
  lastEntry:      string (date)
  expiryDate?:    string
  history:        WarehouseMovement[]   // { date, type:"Entrada"|"Salida", qty, user }
  coordinates?:   { x, y }
  // Campos auto-generados desde proyecto en EJECUCION:
  projectId?:     string               → FK a projects.id
  projectName?:   string
  itemId?:        string               → FK a budget line
  itemName?:      string
  budgetedQty?:   number
  budgetedCost?:  number
  usedQty?:       number
}
```

### 3.6 `transactions`
```
Transaction {
  id:          string
  date:        string
  amount:      number
  description: string
  type:        "INGRESO"|"GASTO"
  category:    string
  projectId?:  string               → FK a projects.id
  staffId?:    string               → FK a staff.id
  qty?:        number
  unitCost?:   number
  createdAt?:  string (ISO)
}
```

### 3.7 `purchaseOrders`
```
PurchaseOrder {
  id:           string
  projectId:    string              → FK a projects.id
  projectName:  string
  supplierId:   string              → FK a suppliers.id
  supplierName: string
  status:       "PENDIENTE"|"APROBADA"|"RECIBIDA"|"CANCELADA"
  items:        PurchaseOrderItem[]  // { itemId?, itemName?, materialName, unit, qty, unitPrice, total }
  total:        number
  createdAt:    string (ISO)
  notes?:       string
}
```

### 3.8 `logs`
```
LogEntry {
  id:           string
  timestamp:    string (ISO)
  level:        "info"|"warn"|"error"|"success"
  action:       string
  details?:     string
  userId?:      string
  projectId?:   string             → FK a projects.id
  projectName?: string
  itemId?:      string
  itemName?:    string
  author?:      string
  type?:        string
}
```

### 3.9 `payrolls`
```
Payroll {
  id:              string
  projectId:       string           → FK a projects.id
  projectName:     string
  period:          string
  type:            "CAMPO"|"ADMINISTRATIVO"
  employees:       PayrollEmployee[]
  totalGross:      number
  totalDeductions: number
  totalBonuses:    number
  totalNet:        number
  status:          "BORRADOR"|"PAGADA"|"CANCELADA"
  createdAt:       string (ISO)
  paidAt?:         string (ISO)
  notes?:          string
}
```

---

## 4. Diagrama de Relaciones (Entidad-Relación)

```
┌───────────┐       ┌──────────────┐       ┌───────────┐
│  clients   │──1:N──│   projects   │──1:N──│inventory  │
│            │       │              │       │(projectId)│
│proyectosIds│       │clientId      │       └───────────┘
└───────────┘       │teamIds[N]──┐ │
                    │budgetTree[]│ │       ┌───────────┐
                    └────────────┼─┘──1:N──│transact.  │
                                 │         │(projectId)│
                    ┌────────────┘         └───────────┘
                    │
               ┌────┴──────┐       ┌───────────┐
               │   staff    │──1:N─│  payrolls  │
               │            │       │(projectId) │
               └────────────┘       └───────────┘

┌───────────┐       ┌──────────────┐
│ suppliers  │──1:N──│purchaseOrders│
│            │       │(supplierId)  │
└───────────┘       │(projectId)───│──→ projects
                    └──────────────┘

┌───────────┐       ┌──────────────┐
│ projects   │──1:N─│    logs       │
│            │       │(projectId)   │
└───────────┘       └──────────────┘
```

### Convención de Flechas
- `─1:N─` → Una entidad puede tener muchos hijos
- `──→` → FK (foreign key) blanda por string ID
- `──│─` → FK inversa (array de IDs)

---

## 5. Flujo de Datos — Patrones de Acceso

### 5.1 Capa de Datos (firestoreService.ts)
```
getDocumentsForCollection(name)
  ├── Intenta: GET {FIRESTORE_URL}/projects → parse docs
  ├── Éxito:   cachea en localStorage (cacheService.cacheCollection)
  └── Falla:   sirve desde caché (cacheService.getCachedCollection)

addDocument(name, data)
  ├── Online:  POST {FIRESTORE_URL}/projects → genera UUID cliente → retorna ID
  └── Offline: encola en offlineQueue + actualiza cache local inmediato

updateDocument(name, id, data)
  ├── Online:  PATCH {FIRESTORE_URL}/projects/{id}
  │   └── Si data.status === 'EJECUCION' y status anterior ≠ EJECUCION:
  │       └── generateProjectStock(project) → crea items en inventory
  └── Offline: encola + cache local

deleteDocument(name, id)
  ├── Online:  DELETE {FIRESTORE_URL}/projects/{id}
  └── Offline: encola + cache local
```

### 5.2 Sincronización Offline
```
Navigator.onLine = false
  → addDocument => localStorage (app_offline_queue_v1)
  → updateDocument => localStorage (app_offline_queue_v1)
  → deleteDocument => localStorage (app_offline_queue_v1)

Navigator.onLine = true (detectado por NetworkStatusContext cada 30s)
  → processPendingQueue()
     → FIFO: replay todas las operaciones
     → Máximo 5 reintentos por operación
     → Descarta si excede reintentos
     → En EJECUCION: ejecuta generateProjectStock inline
```

### 5.3 Propagación Automática: Proyecto a Inventario
```
updateDocument('projects', id, { status: 'EJECUCION' })
  → detecta transición: currentData.status !== 'EJECUCION' && status === 'EJECUCION'
  → generateProjectStock(project)
     → Itera project.items[].materials[]
     → Agrupa por (name + unit), suma cantidades
     → Deduplica contra inventory existente (mismo projectId)
     → Crea WarehouseItem por cada material único
       { name, unit, cat:'Materiales', stock:0, minStock, projectId, projectName, budgetedQty, budgetedCost, usedQty:0 }
  → Retorna número de items creados
```

---

## 6. Integridad de Datos — Validación

### 6.1 Problemas Detectados

| # | Problema | Severidad | Módulos Afectados | Impacto |
|---|---------|-----------|-------------------|---------|
| 1 | **`payrolls` no está en `REQUIRED_COLLECTIONS`** | Media | Staff, DataStore, Analytics | `checkCollections()` no valida payrolls. Si la colección no existe, falla silenciosamente. |
| 2 | **Múltiples suscripciones a la misma colección** | Media | Projects, Staff, Suppliers, Inventory, GanttChart | Cada módulo hace polling c/30s a la misma colección. 5 suscripciones a `projects` = 5 req/min. Ineficiente. |
| 3 | **Sin cascada al eliminar proyecto** | Alta | Todos | Eliminar un proyecto deja huérfanos: transacciones, purchaseOrders, inventory items, logs. `clients.proyectosIds` no se actualiza. |
| 4 | **Bidireccional staff ↔ projects no sincronizada** | Media | Staff, Projects | `staff.projectIds[]` y `projects.teamIds[]` pueden divergir. No hay mecanismo de sincronización automática. |
| 5 | ~~Dual tipo system (models/ vs constants/)~~ | ~~Alta~~ | ~~Todos~~ | ✅ **RESUELTO**: 7 modelos nuevos creados, Client/Project mergeados en models/. constants.ts es hub puro (re-exports + datos). |
| 6 | **Patrón de acceso inconsistente** | Media | Staff, Suppliers, Inventory, Projects | Estos módulos bypassan DataStore (Zustand SSOT) y hacen subscribeToCollection directo. No aprovechan cache offline ni estado centralizado. |
| 7 | **Transactions sin FK enforcement** | Baja | Dashboard | `projectId` en Transaction es opcional. Transacciones pueden crearse sin proyecto, o con projectId inválido. |
| 8 | **generateProjectStock usa `project.items[]` (legacy)** | Alta | firestoreService | `generateProjectStock` itera `project.items` (array de WorkItem), no `project.budgetTree`. Si el proyecto usa el nuevo modelo `budgetTree`, no genera stock. |ü

### 6.2 Validaciones Recomendadas

```typescript
// Verificación de consistencia entre staff ↔ projects
function validateTeamConsistency(store: DataStoreState): string[] {
  const issues: string[] = [];
  for (const p of store.projects.items) {
    for (const tid of p.teamIds || []) {
      if (!store.staff.byId.has(tid)) {
        issues.push(`Project ${p.id}: teamId ${tid} no existe en staff`);
      }
    }
  }
  return issues;
}

// Verificación de huérfanos
function validateOrphans(store: DataStoreState) {
  const projectIds = new Set(store.projects.items.map(p => p.id));
  const orphanTx = store.transactions.items.filter(t => t.projectId && !projectIds.has(t.projectId));
  const orphanPO = store.purchaseOrders.items.filter(po => !projectIds.has(po.projectId));
  const orphanInv = store.inventory.items.filter(i => i.projectId && !projectIds.has(i.projectId));
  return { orphanTx, orphanPO, orphanInv };
}
```

---

## 7. Mapa de Dependencias entre Módulos

```
                         ┌──────────────────────┐
                         │   DataStore (Zustand) │
                         │   Único punto de      │
                         │   suscripción Firestore│
                         └───────────┬──────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────────┐
          │              ┌───────────┴───────────┐                  │
          │              │                       │                  │
   ┌──────┴──────┐ ┌─────┴──────┐        ┌──────┴──────┐    ┌─────┴──────┐
   │  Lectura +  │ │  Lectura   │        │  Lectura +  │    │  Sólo     │
   │  Escritura  │ │            │        │  Escritura  │    │  Lectura  │
   │             │ │            │        │             │    │           │
   │ Dashboard   │ │Clients     │        │ Projects    │    │Seguimiento│
   │ Staff       │ │Segto.      │        │ Inventory   │    │Analytics  │
   │ Suppliers   │ │GanttChart  │        │             │    │Execution  │
   └─────────────┘ └────────────┘        └─────────────┘    └───────────┘

   **Relaciones lógicas entre colecciones (sin FK automáticas):**
   projects.clientId ──→ clients.id
   projects.teamIds[] ──→ staff.id  ←──bi──→ staff.projectIds[]
   inventory.projectId ──→ projects.id
   transactions.projectId ──→ projects.id
   purchaseOrders.projectId ──→ projects.id
   purchaseOrders.supplierId ──→ suppliers.id
   payrolls.projectId ──→ projects.id
   logs.projectId ──→ projects.id

   **Leyenda:**
   - `──→` → FK blanda por string ID
   - `←──bi──→` → bidireccional sin sincronización automática

---

## 8. Contextos y Estado Global

```
<AuthProvider>
  │ user, signIn, signOut, loading
  │ Persistencia: Firebase Auth (browserLocalPersistence)
  │
  <SettingsProvider>
  │  settings { theme, accentColor, companyName, NIT, contact }
  │  Persistencia: localStorage + Firestore userSettings/{uid}
  │  Debounce: 800ms
  │
  <ThemeProvider>
  │  Aplica CSS custom properties desde settings
  │
  <ProjectFilterProvider>
  │  selectedProjectId, executingProjects (filtro)
  │  Persistencia: in-memory only
  │
  <NetworkStatusProvider>
  │  isOnline, syncStatus (pending, syncing, lastSync)
  │  Heartbeat: Firestore REST API cada 30s
  │
  <Toaster>  ← sonner
    <AppShell>
      <Sidebar />  ← lg+
      <MobileNav />  ← <lg
      <TopBar />
      <div id="main-content">
        {lazy(Module)} ← según activeTab
      </div>
    </AppShell>
  </Toaster>
```

---

## 9. Resumen de Issues — Estado Actual

| Prioridad | Issue | Estado | Cambio Realizado |
|-----------|-------|--------|-----------------|
| **Alta** | Sin cascada al eliminar proyecto | ✅ **RESUELTO** | `cascadeDeleteProject()` en firestoreService.ts: elimina transactions, purchaseOrders, inventory, logs vinculados + actualiza clients.proyectosIds |
| **Alta** | generateProjectStock usa `items[]` legacy | ✅ **RESUELTO** | Ahora extrae materiales de `items[]` (legacy) y `budgetTree[]` (nuevo) con soporte recursivo para árboles anidados |
| **Alta** | Dual type system | ✅ **RESUELTO** | 7 modelos nuevos en `src/models/`, Client/Project mergeados, constants.ts es hub puro (solo re-exports + datos). DataStore importa de models/ |
| **Media** | payrolls no en REQUIRED_COLLECTIONS | ✅ **RESUELTO** | Agregado `'payrolls'` al array en firestoreService.ts:296 |
| **Media** | Múltiples suscripciones duplicadas | ✅ **RESUELTO** | Staff, Suppliers, Inventory, Projects, GanttChart migrados a `useStore()`. Solo AIAssistant/AIFloatingButton/ProjectBuilder mantienen subscribe propio (read-only). |
| **Media** | Bidireccional staff/projects desincronizada | ✅ **RESUELTO** | `firestoreService.ts:updateDocument()` sincroniza automáticamente cuando cambia `teamIds`. Staff se actualiza en tiempo real. |
| **Baja** | Sin validación de FK | ❌ **NO RESUELTO** | `validateForeignKeys()` en addDocument. `validateAll()` accesible desde Dashboard (botón "Validar Datos"). |

---

## 10. Estadísticas del Proyecto

| Métrica | Valor | Cambio |
|---------|-------|--------|
| Archivos de componentes (tsx) | ~30 | — |
| Líneas de código totales | ~22,000 | — |
| Colecciones Firestore | 10 (9 REQUIRED + userSettings) | +1 (payrolls agregado) |
| Módulos funcionales | 13 tabs + Layout | — |
| Módulos con DataStore | **11** | +5 (Staff, Suppliers, Inventory, Projects, GanttChart) |
| Módulos con subscribe propio | 3 (AIAssistant, AIFloatingButton, ProjectBuilder) | -4 |
| Suscripciones activas totales | ~10 (9 DataStore + 3 read-only) | -18 (desde ~28) |
| Motores de cálculo | 2 (budgetEngine.ts, ganttCPM.ts) | — |
| Generadores de reportes | 2 (reportEngine.ts nuevo + reports.ts legacy) | — |
| Contextos React | 5 (Auth, Settings, Theme, ProjectFilter, NetworkStatus) | — |
