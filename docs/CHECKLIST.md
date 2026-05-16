# Checklist de Implementación — ERP Constructora WM

> Lista de verificación de todas las sugerencias de arquitectura, integridad y mantenimiento.
> Estado actualizado: 2026-05-16

---

## 1. Modelo de Datos

| # | Ítem | Estado | Archivo / Evidencia |
|---|------|--------|---------------------|
| 1.1 | Unificar tipos duales (`constants/` → `models/`) | ✅ **HECHO** | 7 modelos nuevos (staff, transaction, warehouse, payroll, purchaseOrder, supplier, log), Client/Project mergeados. constants.ts es hub puro + datos. DataStore importa de models/ |
| 1.2 | Bidireccional Staff ↔ Projects sincronizada | ✅ **HECHO** | `firestoreService.ts:updateDocument()` — cuando cambia `teamIds`, actualiza `staff.projectIds` automáticamente |
| 1.3 | Validación FK en escritura | ✅ **HECHO** | `firestoreService.ts:validateForeignKeys()` — verifica `projectId`, `supplierId` contra documentos existentes en `addDocument()` |
| 1.4 | FK enforcement en Firestore rules | ✅ **HECHO** | `firestore.rules` — reglas específicas por colección, protección de payrolls/logs |

## 2. Suscripciones y Acceso a Datos

| # | Ítem | Estado | Archivo / Evidencia |
|---|------|--------|---------------------|
| 2.1 | Suscripciones duplicadas eliminadas | ✅ **HECHO** | 28 → ~10 suscripciones activas. Staff, Suppliers, Inventory, Projects, GanttChart migrados a `useStore()` |
| 2.2 | DataStore como SSOT | ✅ **HECHO** | `src/store/DataStore.ts` — única fuente de verdad para 9 colecciones |
| 2.3 | Cache offline en localStorage | ✅ **HECHO** | `src/services/cacheService.ts` — `app_cache_v1_*` con fallback automático |
| 2.4 | Cola offline con reintentos | ✅ **HECHO** | `src/services/offlineQueue.ts` — FIFO, hasta 5 reintentos, descarte si excede |
| 2.5 | Sincronización automática al reconectar | ✅ **HECHO** | `NetworkStatusContext.tsx` — heartbeat 30s → `processPendingQueue()` |

## 3. Integridad y Consistencia

| # | Ítem | Estado | Archivo / Evidencia |
|---|------|--------|---------------------|
| 3.1 | Cascade delete proyectos | ✅ **HECHO** | `firestoreService.ts:cascadeDeleteProject()` — elimina transactions, purchaseOrders, inventory, logs + actualiza clients.proyectosIds |
| 3.2 | `payrolls` en REQUIRED_COLLECTIONS | ✅ **HECHO** | `firestoreService.ts:296` — `checkCollections()` ahora valida payrolls |
| 3.3 | Validación periódica de datos | ✅ **HECHO** | `src/utils/validators.ts` — `validateTeamConsistency()`, `validateOrphans()`, `validateAll()` |
| 3.4 | Detección de huérfanos | ✅ **HECHO** | `validateOrphans()` — verifica transactions, purchaseOrders, inventory, payrolls, logs |
| 3.5 | Validación bidireccional staff↔projects | ✅ **HECHO** | `validateTeamConsistency()` — detecta referencias rotas en ambos sentidos |
| 3.6 | Export DataStoreState para validadores | ✅ **HECHO** | `DataStore.ts:68` — `export interface DataStoreState` |
| 3.7 | Validadores integrados en UI | ✅ **HECHO** | `Dashboard.tsx` — botón "Validar Datos" en sidebar, panel con conteo por severidad + detalle de issues |
| 3.8 | Audit trail automático en CRUD | ✅ **HECHO** | `firestoreService.ts:addAuditLog()` — registra create/update/delete en `logs` para 8 colecciones críticas |

## 4. Flujo y Propagación

| # | Ítem | Estado | Archivo / Evidencia |
|---|------|--------|---------------------|
| 4.1 | generateProjectStock con budgetTree | ✅ **HECHO** | `firestoreService.ts` — soporte dual `items[]` (legacy) + `budgetTree[]` (nuevo) con niños recursivos |
| 4.2 | Stock automático al entrar EJECUCION | ✅ **HECHO** | `firestoreService.ts:updateDocument()` — trigger en status `EJECUCION` |
| 4.3 | Sync staff.projectIds al cambiar teamIds | ✅ **HECHO** | `updateDocument()` — detecta added/removed team members y actualiza staff |

## 5. Seguridad y Acceso

| # | Ítem | Estado | Archivo / Evidencia |
|---|------|--------|---------------------|
| 5.1 | Reglas Firestore específicas por colección | ✅ **HECHO** | `firestore.rules` — projects, clients, staff, suppliers, inventory, transactions, purchaseOrders, logs (solo admin delete), payrolls (admin), userSettings, _diagnostico |
| 5.2 | Payrolls protegido (solo admin) | ✅ **HECHO** | `firestore.rules` — `isAdmin()` requerido para payrolls |
| 5.3 | Logs protegido (solo admin delete) | ✅ **HECHO** | `firestore.rules` — solo admin puede eliminar logs |
| 5.4 | Denegar todo lo demás por defecto | ✅ **HECHO** | `firestore.rules` — `match /{collection}/{docId} { allow read, write: if false; }` |

## 6. UI / Componentes

| # | Ítem | Estado | Archivo / Evidencia |
|---|------|--------|---------------------|
| 6.1 | Formularios con `.input`/`.select`/`.textarea`/`.label` | ✅ **HECHO** | Todos los componentes refactorizados — Clients, Staff, Suppliers, Inventory, Projects, Settings, Dashboard, Seguimiento |
| 6.2 | Botones con `<Button>` component | ✅ **HECHO** | Todos los botones de formularios y acciones principales |
| 6.3 | Botones raw restantes limpiados | ✅ **HECHO** | Staff toolbar, Suppliers toolbar, Inventory OC form, TopBarClock, Projects toolbar, Analytics toolbar, Execution |
| 6.4 | Panel de salud de datos en Dashboard | ✅ **HECHO** | `Dashboard.tsx:sidebar` — botón "Validar Datos", muestra conteo high/medium/low + lista de issues |

## 7. Cloud Functions (Serverless)

| # | Ítem | Estado | Archivo / Evidencia |
|---|------|--------|---------------------|
| 7.1 | Documentación de migración a Cloud Functions | ✅ **HECHO** | `docs/FUNCTIONS.md` — cascadeDelete, syncStaffProjects, generateStock, periodicValidation |
| 7.2 | Cascade delete server-side | ✅ **HECHO** | `functions/src/cascadeDelete.ts` — onDelete project, limpia 5 colecciones + actualiza client |
| 7.3 | Sync staff↔projects server-side | ✅ **HECHO** | `functions/src/syncStaffProjects.ts` — onWrite project, sincroniza staff.projectIds |
| 7.4 | Generate stock server-side | ✅ **HECHO** | `functions/src/generateStock.ts` — onUpdate project → EJECUCION, extrae materiales de budgetTree/items |
| 7.5 | Validación periódica automática | ✅ **HECHO** | `functions/src/periodicValidation.ts` — Cloud Scheduler lunes 6AM, reporta issues a logs |

## 8. Documentación

| # | Ítem | Estado | Archivo / Evidencia |
|---|------|--------|---------------------|
| 8.1 | Arquitectura lógica documentada | ✅ **HECHO** | `docs/ARCHITECTURE.md` — diagramas, módulos, colecciones, integridad, estadísticas |
| 8.2 | Checklist de implementación | ✅ **HECHO** | Este documento (`docs/CHECKLIST.md`) |
| 8.3 | Migración a Cloud Functions documentada | ✅ **HECHO** | `docs/FUNCTIONS.md` — plantillas de funciones serverless |
| 8.4 | AGENTS.md actualizado | ✅ **HECHO** | `AGENTS.md` — guía de contexto para el agente |

---

## Resumen

| Categoría | Total Ítems | ✅ Hechos | ⏳ Pendientes | 📄 Documentados |
|-----------|-------------|-----------|---------------|-----------------|
| Modelo de Datos | 4 | 4 | 0 | 0 |
| Suscripciones y Datos | 5 | 5 | 0 | 0 |
| Integridad y Consistencia | 8 | 8 | 0 | 0 |
| Flujo y Propagación | 3 | 3 | 0 | 0 |
| Seguridad y Acceso | 4 | 4 | 0 | 0 |
| UI / Componentes | 4 | 4 | 0 | 0 |
| Cloud Functions | 5 | 5 | 0 | 0 |
| Documentación | 4 | 4 | 0 | 0 |
| **Total** | **37** | **37** | **0** | **0** |

**37/37 completados (100%) ✅**
