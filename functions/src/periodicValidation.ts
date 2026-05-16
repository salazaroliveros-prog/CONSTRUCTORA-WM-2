import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Validación periódica de integridad de datos.
 * Se ejecuta cada lunes a las 6:00 AM vía Cloud Scheduler.
 * Detecta referencias rotas y huérfanos en todas las colecciones.
 */
export const periodicValidation = functions.pubsub
  .schedule('0 6 * * 1')
  .timeZone('America/Guatemala')
  .onRun(async () => {
    const db = admin.firestore();
    const issues: string[] = [];

    try {
      // 1. Verificar consistencia Staff ↔ Projects
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
            issues.push(`[FK] Project ${doc.id} ("${data.name}") references unknown staff ${tid}`);
          }
        }
      }

      for (const doc of staffSnap.docs) {
        const data = doc.data();
        for (const pid of data.projectIds || []) {
          if (!projectIds.has(pid)) {
            issues.push(`[FK] Staff ${doc.id} ("${data.name}") references unknown project ${pid}`);
          }
        }
      }

      // 2. Verificar huérfanos en colecciones vinculadas a proyectos
      const orphanCollections = [
        { name: 'transactions', idField: 'projectId' },
        { name: 'purchaseOrders', idField: 'projectId' },
        { name: 'inventory', idField: 'projectId' },
        { name: 'payrolls', idField: 'projectId' },
        { name: 'logs', idField: 'projectId' },
      ];

      for (const col of orphanCollections) {
        const snap = await db.collection(col.name)
          .where(col.idField, '!=', '')
          .get();
        for (const doc of snap.docs) {
          const data = doc.data();
          const fk = data[col.idField];
          if (fk && !projectIds.has(fk)) {
            issues.push(`[ORPHAN] ${col.name}/${doc.id} references missing project ${fk}`);
          }
        }
      }

      // 3. Verificar purchaseOrders → suppliers
      const suppliersSnap = await db.collection('suppliers').get();
      const supplierIds = new Set(suppliersSnap.docs.map(d => d.id));
      const poSnap = await db.collection('purchaseOrders').get();
      for (const doc of poSnap.docs) {
        const data = doc.data();
        if (data.supplierId && !supplierIds.has(data.supplierId)) {
          issues.push(`[ORPHAN] purchaseOrders/${doc.id} references missing supplier ${data.supplierId}`);
        }
      }

      // 4. Verificar projects → clients
      const clientsSnap = await db.collection('clients').get();
      const clientIds = new Set(clientsSnap.docs.map(d => d.id));
      for (const doc of projectsSnap.docs) {
        const data = doc.data();
        if (data.clientId && !clientIds.has(data.clientId)) {
          issues.push(`[FK] Project ${doc.id} references missing client ${data.clientId}`);
        }
      }

      // Reportar resultados
      if (issues.length > 0) {
        functions.logger.warn(`[validation] Found ${issues.length} issues:`, issues.join('\n'));
        // En producción, enviar alerta (email, Slack, etc.)
        await db.collection('logs').add({
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          level: 'warn',
          action: 'periodic_validation',
          details: `${issues.length} issues found:\n${issues.join('\n')}`,
          userId: 'system',
          projectId: '_system',
        });
      } else {
        functions.logger.info('[validation] No issues found — data integrity OK');
        await db.collection('logs').add({
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          level: 'info',
          action: 'periodic_validation',
          details: 'No issues found — data integrity OK',
          userId: 'system',
          projectId: '_system',
        });
      }
    } catch (err) {
      functions.logger.error('[validation] Error during validation:', err);
    }
  });
