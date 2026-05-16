import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { extractBudgetMaterials, extractLegacyMaterials } from './extractMaterials';

/**
 * Genera inventario automáticamente cuando un proyecto cambia a EJECUCION.
 * Extrae materiales de budgetTree (nuevo) o items[] (legacy) y crea
 * WarehouseItems con stock=0, minStock calculado.
 */
export const generateProjectStockOnExecution = functions.firestore
  .document('projects/{projectId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const projectId = context.params.projectId;

    if (before.status === 'EJECUCION' || after.status !== 'EJECUCION') {
      return; // Solo ejecutar en transición a EJECUCION
    }

    const db = admin.firestore();

    // Extraer materiales: budgetTree (nuevo) o items (legacy)
    let materials = extractBudgetMaterials(after.budgetTree || []);
    if (materials.length === 0) {
      materials = extractLegacyMaterials(after.items || []);
    }
    if (materials.length === 0) {
      functions.logger.info(`[stock] No materials found for project ${projectId}`);
      return;
    }

    // Obtener inventario existente para evitar duplicados
    const existingSnapshot = await db.collection('inventory')
      .where('projectId', '==', projectId)
      .get();
    const existingKeys = new Set(
      existingSnapshot.docs.map(d => `${d.data().name}__${d.data().unit}`)
    );

    const today = new Date().toISOString().split('T')[0];
    const batch = db.batch();
    let created = 0;

    for (const mat of materials) {
      const key = `${mat.name}__${mat.unit}`;
      if (existingKeys.has(key)) continue;

      const newItemRef = db.collection('inventory').doc();
      batch.set(newItemRef, {
        name: mat.name,
        cat: 'Materiales',
        stock: 0,
        unit: mat.unit,
        location: 'Almacén Central',
        minStock: Math.max(1, Math.ceil(mat.qty * 0.1)),
        lastEntry: today,
        history: [],
        projectId,
        projectName: after.name || '',
        budgetedQty: Math.round(mat.qty * 100) / 100,
        budgetedCost: mat.cost,
        usedQty: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      created++;
    }

    if (created > 0) {
      await batch.commit();
      functions.logger.info(`[stock] Created ${created} inventory items for project ${projectId}`);
    } else {
      functions.logger.info(`[stock] All ${materials.length} materials already exist for project ${projectId}`);
    }
  });
