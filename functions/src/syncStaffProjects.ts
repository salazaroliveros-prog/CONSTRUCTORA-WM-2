import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Sincronización bidireccional Staff ↔ Projects.
 * Cuando cambia teamIds en un proyecto, actualiza staff.projectIds.
 */
export const syncStaffProjects = functions.firestore
  .document('projects/{projectId}')
  .onWrite(async (change, context) => {
    const projectId = context.params.projectId;
    const db = admin.firestore();
    const after = change.after.exists ? change.after.data() : null;
    const before = change.before.exists ? change.before.data() : null;

    if (!after) {
      // Proyecto eliminado: remover projectId de todos los staff que lo referencian
      try {
        const staffSnapshot = await db.collection('staff')
          .where('projectIds', 'array-contains', projectId)
          .get();
        if (staffSnapshot.empty) return;
        const batch = db.batch();
        staffSnapshot.docs.forEach(doc => {
          const data = doc.data();
          batch.update(doc.ref, {
            projectIds: (data.projectIds || []).filter((p: string) => p !== projectId),
          });
        });
        await batch.commit();
        functions.logger.info(`[sync] Removed project ${projectId} from ${staffSnapshot.size} staff members`);
      } catch (err) {
        functions.logger.warn(`[sync] Error cleaning staff for deleted project ${projectId}:`, err);
      }
      return;
    }

    const oldTeamIds: string[] = before?.teamIds || [];
    const newTeamIds: string[] = after.teamIds || [];
    const added = newTeamIds.filter((id: string) => !oldTeamIds.includes(id));
    const removed = oldTeamIds.filter((id: string) => !newTeamIds.includes(id));

    if (added.length === 0 && removed.length === 0) return;

    const batch = db.batch();

    // Remover projectId de staff que ya no están en el equipo
    if (removed.length > 0) {
      try {
        const toRemove = await db.collection('staff')
          .where(admin.firestore.FieldPath.documentId(), 'in', removed)
          .get();
        toRemove.docs.forEach(doc => {
          const data = doc.data();
          batch.update(doc.ref, {
            projectIds: (data.projectIds || []).filter((p: string) => p !== projectId),
          });
        });
      } catch (err) {
        functions.logger.warn(`[sync] Error fetching removed staff:`, err);
      }
    }

    // Agregar projectId a staff nuevos en el equipo
    if (added.length > 0) {
      try {
        const toAdd = await db.collection('staff')
          .where(admin.firestore.FieldPath.documentId(), 'in', added)
          .get();
        toAdd.docs.forEach(doc => {
          const data = doc.data();
          const projects = data.projectIds || [];
          if (!projects.includes(projectId)) {
            batch.update(doc.ref, { projectIds: [...projects, projectId] });
          }
        });
      } catch (err) {
        functions.logger.warn(`[sync] Error fetching added staff:`, err);
      }
    }

    await batch.commit();
    functions.logger.info(`[sync] Synced ${added.length} added + ${removed.length} removed staff for project ${projectId}`);
  });
