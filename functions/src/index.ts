/**
 * Cloud Functions — ERP Constructora WM
 *
 * Punto de entrada único que re-exporta todas las funciones.
 * Deploy: npm run deploy
 *
 * Funciones disponibles:
 * - cascadeDeleteProject      → onDelete project → limpia datos relacionados
 * - syncStaffProjects          → onWrite project → sincroniza staff.projectIds
 * - generateProjectStockOnExecution → onUpdate project (EJECUCION) → crea inventory
 * - periodicValidation         → pubsub schedule (lunes 6AM) → verifica integridad
 */

import * as admin from 'firebase-admin';

admin.initializeApp();

export { cascadeDeleteProject } from './cascadeDelete';
export { syncStaffProjects } from './syncStaffProjects';
export { generateProjectStockOnExecution } from './generateStock';
export { periodicValidation } from './periodicValidation';
