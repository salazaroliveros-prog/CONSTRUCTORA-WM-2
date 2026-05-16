import { DataStoreState } from '../store/DataStore';

export interface ValidationIssue {
  type: 'orphan_fk' | 'inconsistent_relation' | 'missing_data';
  severity: 'high' | 'medium' | 'low';
  collection: string;
  message: string;
  sourceId: string;
  targetId?: string;
}

export function validateTeamConsistency(store: DataStoreState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const staffIds = new Set(store.staff.items.map(s => s.id));
  const projectIds = new Set(store.projects.items.map(p => p.id));

  for (const project of store.projects.items) {
    for (const tid of project.teamIds || []) {
      if (!staffIds.has(tid)) {
        issues.push({
          type: 'orphan_fk',
          severity: 'high',
          collection: 'projects',
          message: `Project "${project.name}" references staff ${tid} that does not exist`,
          sourceId: project.id,
          targetId: tid,
        });
      }
    }
  }

  for (const staff of store.staff.items) {
    for (const pid of staff.projectIds || []) {
      if (!projectIds.has(pid)) {
        issues.push({
          type: 'orphan_fk',
          severity: 'high',
          collection: 'staff',
          message: `Staff "${staff.name}" references project ${pid} that does not exist`,
          sourceId: staff.id,
          targetId: pid,
        });
      }
    }
  }

  return issues;
}

export function validateOrphans(store: DataStoreState): ValidationIssue[] {
  const projectIds = new Set(store.projects.items.map(p => p.id));
  const issues: ValidationIssue[] = [];

  for (const tx of store.transactions.items) {
    if (tx.projectId && !projectIds.has(tx.projectId)) {
      issues.push({
        type: 'orphan_fk',
        severity: 'medium',
        collection: 'transactions',
        message: `Transaction "${tx.description}" (${tx.amount}) references deleted project ${tx.projectId}`,
        sourceId: tx.id,
        targetId: tx.projectId,
      });
    }
  }

  for (const po of store.purchaseOrders.items) {
    if (!projectIds.has(po.projectId)) {
      issues.push({
        type: 'orphan_fk',
        severity: 'medium',
        collection: 'purchaseOrders',
        message: `Purchase order #${po.id?.slice(-6)} references deleted project ${po.projectId}`,
        sourceId: po.id,
        targetId: po.projectId,
      });
    }
  }

  for (const inv of store.inventory.items) {
    if (inv.projectId && !projectIds.has(inv.projectId)) {
      issues.push({
        type: 'orphan_fk',
        severity: 'low',
        collection: 'inventory',
        message: `Inventory item "${inv.name}" references deleted project ${inv.projectId}`,
        sourceId: inv.id,
        targetId: inv.projectId,
      });
    }
  }

  for (const pl of store.payrolls.items) {
    if (!projectIds.has(pl.projectId)) {
      issues.push({
        type: 'orphan_fk',
        severity: 'medium',
        collection: 'payrolls',
        message: `Payroll "${pl.period}" references deleted project ${pl.projectId}`,
        sourceId: pl.id,
        targetId: pl.projectId,
      });
    }
  }

  for (const log of store.logs.items) {
    if (log.projectId && !projectIds.has(log.projectId)) {
      issues.push({
        type: 'orphan_fk',
        severity: 'low',
        collection: 'logs',
        message: `Log entry references deleted project ${log.projectId}`,
        sourceId: log.id,
        targetId: log.projectId,
      });
    }
  }

  return issues;
}

export function validateAll(store: DataStoreState): { issues: ValidationIssue[]; summary: { high: number; medium: number; low: number } } {
  const issues = [...validateTeamConsistency(store), ...validateOrphans(store)];
  const summary = { high: 0, medium: 0, low: 0 };
  issues.forEach(i => summary[i.severity]++);
  return { issues, summary };
}
