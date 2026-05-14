/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Motor de Alertas de Desviación — Versión Unificada
 * 
 * Evalúa desviaciones entre presupuesto y ejecución real
 * con 4 niveles de severidad configurables
 */

import { BudgetLine } from '../lib/budgetData';
import { precise } from './precision';

export interface DeviationAlert {
  lineCode: string;
  description: string;
  budgeted: number;
  actual: number;
  deviationPercent: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  variance: number;          // Diferencia absoluta
  correctiveAction?: string; // Acción recomendada
}

export interface DeviationConfig {
  threshold: number;         // Umbral mínimo para alerta (default: 10%)
  severityLevels: {
    critical: number;        // >= 50%
    high: number;            // >= 30%
    medium: number;          // >= 15%
    low: number;             // >= threshold
  };
}

const DEFAULT_CONFIG: DeviationConfig = {
  threshold: 10,
  severityLevels: {
    critical: 50,
    high: 30,
    medium: 15,
    low: 10,
  },
};

/**
 * Clasifica la severidad de una desviación
 */
export function classifySeverity(deviation: number, config: DeviationConfig = DEFAULT_CONFIG): DeviationAlert['severity'] {
  const abs = Math.abs(deviation);
  if (abs >= config.severityLevels.critical) return 'critical';
  if (abs >= config.severityLevels.high) return 'high';
  if (abs >= config.severityLevels.medium) return 'medium';
  if (abs >= config.severityLevels.low) return 'low';
  return 'low'; // Por debajo del umbral, no debería llegar aquí
}

/**
 * Genera recomendación de acción correctiva basada en severidad
 */
export function getCorrectiveAction(severity: DeviationAlert['severity'], description: string): string {
  const actions: Record<DeviationAlert['severity'], string> = {
    critical: `ATENCIÓN INMEDIATA: Reunión de emergencia para "${description}". Revisar proveedores, replanificar actividades.`,
    high: `ALERTA: Revisar actividad "${description}". Evaluar proveedores alternativos y ajustar cronograma.`,
    medium: `MONITOREO: Seguimiento reforzado en "${description}". Verificar rendimientos y precios.`,
    low: `INFORMATIVO: Desviación menor en "${description}". Monitorear en próximos reportes.`,
  };
  return actions[severity] || actions.low;
}

/**
 * Análisis completo de desviaciones en el árbol de presupuesto
 */
export function checkDeviations(
  lines: BudgetLine[],
  actualCosts: Map<string, number>, // Map<lineId, costoReal>
  config?: Partial<DeviationConfig>
): DeviationAlert[] {
  const mergedConfig: DeviationConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    severityLevels: {
      ...DEFAULT_CONFIG.severityLevels,
      ...(config?.severityLevels || {}),
    },
  };

  const alerts: DeviationAlert[] = [];

  function walk(lineList: BudgetLine[]): void {
    for (const line of lineList) {
      const actual = actualCosts.get(line.id);
      
      if (actual !== undefined && actual > 0 && line.subtotal && line.subtotal > 0) {
        const variance = precise(actual - line.subtotal);
        const deviationPercent = precise((variance / line.subtotal) * 100);

        if (Math.abs(deviationPercent) >= mergedConfig.threshold) {
          const severity = classifySeverity(deviationPercent, mergedConfig);
          
          alerts.push({
            lineCode: line.code,
            description: line.description || '',
            budgeted: precise(line.subtotal),
            actual: precise(actual),
            deviationPercent,
            severity,
            variance,
            correctiveAction: getCorrectiveAction(severity, line.description || ''),
          });
        }
      }

      if (line.children && line.children.length > 0) {
        walk(line.children);
      }
    }
  }

  walk(lines);
  
  // Ordenar por severidad (critical → low) y luego por magnitud de desviación
  const severityOrder: Record<DeviationAlert['severity'], number> = {
    critical: 0, high: 1, medium: 2, low: 3,
  };
  
  return alerts.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return Math.abs(b.deviationPercent) - Math.abs(a.deviationPercent);
  });
}

/**
 * Resumen ejecutivo de alertas
 */
export function getAlertSummary(alerts: DeviationAlert[]): {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  worstDeviation: DeviationAlert | null;
  avgDeviation: number;
} {
  if (alerts.length === 0) {
    return { total: 0, critical: 0, high: 0, medium: 0, low: 0, worstDeviation: null, avgDeviation: 0 };
  }

  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  let worstDeviation = alerts[0];
  let totalDeviation = 0;

  for (const alert of alerts) {
    counts[alert.severity]++;
    if (Math.abs(alert.deviationPercent) > Math.abs(worstDeviation.deviationPercent)) {
      worstDeviation = alert;
    }
    totalDeviation += Math.abs(alert.deviationPercent);
  }

  return {
    total: alerts.length,
    critical: counts.critical,
    high: counts.high,
    medium: counts.medium,
    low: counts.low,
    worstDeviation,
    avgDeviation: precise(totalDeviation / alerts.length),
  };
}