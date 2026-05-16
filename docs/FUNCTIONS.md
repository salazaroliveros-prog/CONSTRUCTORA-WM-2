# Cloud Functions — Sincronización y Mantenimiento

> Estrategia: el proyecto actual usa **Vercel serverless** (`/api/*`), no Firebase Functions.
> Para funcionalidades que requieren triggers en tiempo real (cascade delete, sync staff↔projects,
> generar stock), se implementan del **lado cliente** en `firestoreService.ts`.
> Este documento describe cómo migrar a Cloud Functions si se desea.

## Arquitectura Actual (Cliente)

| Trigger | Ubicación | Mecanismo |
|---------|-----------|-----------|
| Cascade delete proyecto | `firestoreService.ts:cascadeDeleteProject()` | Ejecutado en `deleteDocument()` antes del DELETE |
| Sync staff↔projects | `firestoreService.ts:updateDocument()` | Ejecutado en `updateDocument()` cuando cambia `teamIds` |
| Generate stock on EJECUCION | `firestoreService.ts:updateDocument()` | Ejecutado en `updateDocument()` cuando status → EJECUCION |
| FK validation | `firestoreService.ts:validateForeignKeys()` | Ejecutado en `addDocument()` y `updateDocument()` |
| Periodic data validation | `src/utils/validators.ts` | Llamado manual desde UI o scheduler |

## Limitaciones del Enfoque Cliente

1. **Offline queue**: las operaciones encoladas no ejecutan triggers hasta que se procesan
2. **Seguridad**: un cliente malicioso podría saltarse las validaciones
3. **Consistencia**: si el usuario cierra sesión antes de que el trigger se ejecute, se pierde

## Migración a Firebase Cloud Functions (Recomendado)

Para evitar las limitaciones anteriores, migrar los triggers a Firebase Cloud Functions:

### 1. Estructura
```
functions/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              ← exporta todas las funciones
│   ├── cascadeDelete.ts      ← onDelete project
│   ├── syncStaffProjects.ts  ← onWrite project
│   ├── generateStock.ts      ← onUpdate project (EJECUCION)
│   └── maintenance.ts        ← scheduler periódico
└── .env
```

### 2. package.json
```json
{
  "name": "constructora-wm-functions",
  "scripts": {
    "build": "tsc",
    "serve": "npm run build && firebase emulators:start --only functions",
    "deploy": "firebase deploy --only functions"
  },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

### 3. Función: cascadeDelete (onDelete)
```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const cascadeDeleteProject = functions.firestore
  .document('projects/{projectId}')
  .onDelete(async (snap, context) => {
    const projectId = context.params.projectId;
    const db = admin.firestore();
    const projectData = snap.data();

    const deletes = ['transactions', 'purchaseOrders', 'inventory', 'logs', 'payrolls']
      .map(async (col) => {
        const snapshot = await db.collection(col)
          .where('projectId', '==', projectId).get();
        if (snapshot.empty) return;
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      });

    await Promise.all(deletes);

    if (projectData.clientId) {
      await db.collection('clients').doc(projectData.clientId).update({
        proyectosIds: admin.firestore.FieldValue.arrayRemove(projectId),
      });
    }
  });
```

### 4. Función: syncStaffProjects (onWrite)
```typescript
export const syncStaffProjects = functions.firestore
  .document('projects/{projectId}')
  .onWrite(async (change, context) => {
    const projectId = context.params.projectId;
    const db = admin.firestore();
    const after = change.after.exists ? change.after.data() : null;
    const before = change.before.exists ? change.before.data() : null;

    if (!after) {
      // Proyecto eliminado: limpiar staff
      const staffSnapshot = await db.collection('staff')
        .where('projectIds', 'array-contains', projectId).get();
      const batch = db.batch();
      staffSnapshot.docs.forEach(doc => {
        const data = doc.data();
        batch.update(doc.ref, {
          projectIds: (data.projectIds || []).filter((p: string) => p !== projectId),
        });
      });
      await batch.commit();
      return;
    }

    const oldTeamIds: string[] = before?.teamIds || [];
    const newTeamIds: string[] = after.teamIds || [];
    const added = newTeamIds.filter((id: string) => !oldTeamIds.includes(id));
    const removed = oldTeamIds.filter((id: string) => !newTeamIds.includes(id));

    const batch = db.batch();

    // Remover projectId de staff removidos del equipo
    if (removed.length > 0) {
      const toRemove = await db.collection('staff')
        .where(admin.firestore.FieldPath.documentId(), 'in', removed).get();
      toRemove.docs.forEach(doc => {
        const data = doc.data();
        batch.update(doc.ref, {
          projectIds: (data.projectIds || []).filter((p: string) => p !== projectId),
        });
      });
    }

    // Agregar projectId a staff nuevos
    if (added.length > 0) {
      const toAdd = await db.collection('staff')
        .where(admin.firestore.FieldPath.documentId(), 'in', added).get();
      toAdd.docs.forEach(doc => {
        const data = doc.data();
        const projects = data.projectIds || [];
        if (!projects.includes(projectId)) {
          batch.update(doc.ref, { projectIds: [...projects, projectId] });
        }
      });
    }

    await batch.commit();
  });
```

### 5. Función: generateStockOnExecution (onUpdate)
```typescript
export const generateProjectStockOnExecution = functions.firestore
  .document('projects/{projectId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (before.status !== 'EJECUCION' && after.status === 'EJECUCION') {
      // Reutilizar la lógica de extractBudgetMaterials
      const materials = extractBudgetMaterials(after.budgetTree || []);
      if (materials.length === 0) return;

      const db = admin.firestore();
      const projectId = context.params.projectId;

      const existing = await db.collection('inventory')
        .where('projectId', '==', projectId).get();
      const existingKeys = new Set(
        existing.docs.map(d => `${d.data().name}__${d.data().unit}`)
      );

      const batch = db.batch();
      for (const mat of materials) {
        const key = `${mat.name}__${mat.unit}`;
        if (existingKeys.has(key)) continue;
        batch.set(db.collection('inventory').doc(), {
          name: mat.name, unit: mat.unit, cat: 'Materiales',
          stock: 0, location: 'Almacén Central',
          minStock: Math.max(1, Math.ceil(mat.qty * 0.1)),
          projectId, projectName: after.name,
          budgetedQty: mat.qty, budgetedCost: mat.cost, usedQty: 0,
          lastEntry: new Date().toISOString().split('T')[0],
          history: [],
        });
      }
      await batch.commit();
    }
  });

function extractBudgetMaterials(lines: any[]): { name: string; unit: string; qty: number; cost: number }[] {
  const result: { name: string; unit: string; qty: number; cost: number }[] = [];
  for (const line of lines) {
    for (const m of line.materials || []) {
      const qty = (m.quantity || 0) * (line.projectQuantity || 1);
      result.push({ name: m.name, unit: m.unit || 'U', qty, cost: m.unitPrice || 0 });
    }
    if (line.children) result.push(...extractBudgetMaterials(line.children));
  }
  return result;
}
```

### 6. Función: PeriodicValidation (Cloud Scheduler)
```typescript
export const periodicValidation = functions.pubsub
  .schedule('0 6 * * 1') // Cada lunes 6:00 AM
  .onRun(async () => {
    const db = admin.firestore();
    const issues: string[] = [];

    // Verificar staff ↔ projects
    const [projectsSnap, staffSnap] = await Promise.all([
      db.collection('projects').get(),
      db.collection('staff').get(),
    ]);

    const projectIds = new Set(projectsSnap.docs.map(d => d.id));
    const staffIds = new Set(staffSnap.docs.map(d => d.id));

    for (const doc of projectsSnap.docs) {
      const data = doc.data();
      for (const tid of data.teamIds || []) {
        if (!staffIds.has(tid)) {
          issues.push(`Project ${doc.id} references unknown staff ${tid}`);
        }
      }
    }

    // Verificar huérfanos
    const orphans = ['transactions', 'purchaseOrders', 'inventory', 'payrolls'];
    for (const col of orphans) {
      const snap = await db.collection(col)
        .where('projectId', '!=', '').get();
      for (const doc of snap.docs) {
        const data = doc.data();
        if (data.projectId && !projectIds.has(data.projectId)) {
          issues.push(`Orphan ${col}/${doc.id} references project ${data.projectId}`);
        }
      }
    }

    if (issues.length > 0) {
      // Enviar alerta (email, slack, etc.)
      console.log(`Validation found ${issues.length} issues:`, issues.join('\n'));
    }
  });
```

### 7. Deploy
```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

## Conclusión

Por ahora los triggers del lado cliente son suficientes para el caso de uso actual.
Si la aplicación crece y se requiere mayor consistencia, migrar a Cloud Functions
siguiendo las plantillas de este documento.
