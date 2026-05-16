import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Cascade delete — cuando se elimina un proyecto, limpia todas las
 * colecciones relacionadas y actualiza referencias en clients.
 */
export const cascadeDeleteProject = functions.firestore
  .document('projects/{projectId}')
  .onDelete(async (snap, context) => {
    const projectId = context.params.projectId;
    const db = admin.firestore();
    const projectData = snap.data();

    const linkedCollections = [
      'transactions',
      'purchaseOrders',
      'inventory',
      'logs',
      'payrolls',
    ];

    const deletes = linkedCollections.map(async (col) => {
      try {
        const snapshot = await db.collection(col)
          .where('projectId', '==', projectId)
          .get();
        if (snapshot.empty) return;
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        functions.logger.info(`[cascade] Deleted ${snapshot.size} docs from ${col} for project ${projectId}`);
      } catch (err) {
        functions.logger.warn(`[cascade] Error deleting ${col} for project ${projectId}:`, err);
      }
    });

    await Promise.all(deletes);

    // Actualizar cliente: remover proyecto de proyectosIds
    if (projectData?.clientId) {
      try {
        const clientRef = db.collection('clients').doc(projectData.clientId);
        await clientRef.update({
          proyectosIds: admin.firestore.FieldValue.arrayRemove(projectId),
          totalProyectos: admin.firestore.FieldValue.increment(-1),
        });
        functions.logger.info(`[cascade] Updated client ${projectData.clientId} for project ${projectId}`);
      } catch (err) {
        functions.logger.warn(`[cascade] Error updating client ${projectData.clientId}:`, err);
      }
    }

    functions.logger.info(`[cascade] Completed cleanup for project ${projectId}`);
  });
