/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * reportEngine.ts — Motor unificado de generación de reportes
 * 
 * Reemplaza las funciones duplicadas en reports.ts
 * Garantiza que los reportes usen los mismos valores que el UI
 * 
 * Funciones:
 * - generateReportData: Prepara datos para cualquier tipo de reporte
 * - generateBudgetPDF: PDF profesional de presupuesto completo
 * - generateBudgetPDFEjecutivo: PDF ejecutivo compacto
 * - generateBudgetPDFCliente: PDF para cliente (sin detalles técnicos)
 * - generateBudgetPDFAPU: Análisis de precios unitarios detallado
 * - generateProgressReport: Informe de avance físico-financiero
 * - generateBudgetCSV: Exportación CSV
 * - generateBudgetJSON: Exportación JSON estructurada
 * - generateBOM: Bill of Materials
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Project, MATERIALS_BY_CATEGORY } from '../constants';
import { BudgetLine } from '../lib/budgetData';
import { calculateFullProject, LineResult, BudgetTotals as ProjectTotals } from '../engine/budgetEngine';
import { MarketLevel } from '../lib/marketParams';

// ─── Paleta corporativa ─────────────────────────────────────────────────────────
const COLORS = {
  primary:   [15, 23, 42] as [number, number, number],
  secondary: [251, 191, 36] as [number, number, number], // Amber
  accent:    [59, 130, 246] as [number, number, number],
  success:   [16, 185, 129] as [number, number, number],
  warning:   [251, 146, 60] as [number, number, number],
  danger:    [239, 68, 68] as [number, number, number],
  light:     [248, 250, 252] as [number, number, number],
  dark:      [30, 41, 59] as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
  gray:      [100, 116, 139] as [number, number, number],
};

// ─── Helpers ────────────────────────────────────────────────────────────────────
const fmtCurrency = (n: number): string =>
  n === 0 ? 'Q. 0.00' : `Q. ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (date?: string): string => {
  if (!date) return new Date().toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' });
  return new Date(date).toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' });
};

const setFill = (doc: jsPDF, c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
const setTxt  = (doc: jsPDF, c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
const setDraw = (doc: jsPDF, c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

// ─── Interface para totales sobreescribibles ────────────────────────────────────
interface TotalsOverride {
  directCost?: number;
  materialsTotal?: number;
  laborTotal?: number;
  indirectCost?: number;
  adminCost?: number;
  personalCost?: number;
  totalBudget?: number;
  estimatedDays?: number;
  marketLabel?: string;
}

// ─── Cálculo centralizado de totales ───────────────────────────────────────────
/**
 * Calcula los totales del proyecto con la opción de sobreescribir valores.
 * Esta es LA ÚNICA función que debe usarse para obtener totales de presupuesto.
 * 
 * @param project Datos del proyecto
 * @param budgetTree Árbol de presupuesto calculado
 * @param override Valores sobreescritos (del Engine o cálculos previos)
 * @returns Totales del proyecto
 */
export function calculateProjectReportTotals(
  project: Project,
  budgetTree: BudgetLine[] | undefined,
  override?: TotalsOverride
): ProjectTotals {
  // Si hay override, usar esos valores directamente
  if (override?.totalBudget !== undefined) {
    return {
      materialTotal: override.materialsTotal ?? 0,
      laborTotal: override.laborTotal ?? 0,
      equipmentTotal: 0,
      wasteTotal: 0,
      subtotal: override.directCost ?? 0,
      taxTotal: 0,
      profitTotal: 0,
      contingencyTotal: 0,
      directCost: override.directCost ?? 0,
      indirectCost: override.indirectCost ?? 0,
      adminCost: override.adminCost ?? 0,
      personalCost: override.personalCost ?? 0,
      totalBudget: override.totalBudget ?? 0,
      estimatedDays: override.estimatedDays ?? 0,
      costPerM2: 0,
      lines: [],
    };
  }

  // Si hay budgetTree, usar el Engine unificado
  if (budgetTree && budgetTree.length > 0) {
    const marketLevel = project.marketLevel as MarketLevel | undefined;
    const marketMultipliers = marketLevel ? {
      material: marketLevel.costPerSqm.recommended / 3750,
      labor: marketLevel.laborMultiplier,
    } : undefined;

    const result = calculateFullProject(budgetTree, {
      marketMultipliers,
      indirectCosts: project.indirectCosts,
      adminCosts: project.administrativeCosts,
      personalCosts: project.personalCosts,
      area: project.area,
    });

    return result;
  }

  // Fallback: cálculo básico desde items del proyecto
  const directCost = project.items.reduce((acc, item) => {
    const matSum = item.materials.reduce((m, mat) => m + mat.price * mat.quantity, 0);
    const labSum = item.labor.reduce((l, lab) => l + lab.price * lab.quantity, 0);
    return acc + (matSum + labSum) * item.projectQuantity;
  }, 0);

  const materialsTotal = project.items.reduce((acc, item) => {
    const mat = item.materials.reduce((m, mat) => m + mat.price * mat.quantity, 0);
    return acc + mat * item.projectQuantity;
  }, 0);

  const laborTotal = project.items.reduce((acc, item) => {
    const lab = item.labor.reduce((l, lab) => l + lab.price * lab.quantity, 0);
    return acc + lab * item.projectQuantity;
  }, 0);

  const indirectCost = directCost * (project.indirectCosts / 100);
  const adminCost = directCost * (project.administrativeCosts / 100);
  const personalCost = directCost * (project.personalCosts / 100);
  const totalBudget = directCost + indirectCost + adminCost + personalCost;

  const estimatedDays = project.items.reduce((acc, item) => acc + (item.durationDays || 1) * item.projectQuantity, 0);

  return {
    materialTotal: materialsTotal,
    laborTotal: laborTotal,
    equipmentTotal: 0,
    wasteTotal: 0,
    subtotal: directCost,
    taxTotal: 0,
    profitTotal: 0,
    contingencyTotal: 0,
    directCost,
    indirectCost,
    adminCost,
    personalCost,
    totalBudget,
    estimatedDays,
    costPerM2: 0,
    lines: [],
  };
}

// ─── Encabezado de reporte ─────────────────────────────────────────────────────
const addHeader = (doc: jsPDF, title: string, subtitle?: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  setFill(doc, COLORS.primary);
  doc.rect(0, 0, pageWidth, 45, 'F');
  setFill(doc, COLORS.secondary);
  doc.rect(0, 45, pageWidth, 3, 'F');

  setTxt(doc, COLORS.white);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('CONSTRUCTORA WM/M&S', 15, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Gestión de Obra Profesional', 15, 32);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), pageWidth - 15, 22, { align: 'right' });

  if (subtitle) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, pageWidth - 15, 30, { align: 'right' });
  }

  doc.setFontSize(8);
  doc.text(`Fecha: ${fmtDate()}`, pageWidth - 15, 38, { align: 'right' });
};

// ─── Información del proyecto ──────────────────────────────────────────────────
const addProjectInfo = (doc: jsPDF, project: Project, startY: number): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  setFill(doc, COLORS.primary);
  doc.roundedRect(15, startY, pageWidth - 30, 35, 3, 3, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  setTxt(doc, COLORS.white);
  doc.text('DATOS DEL PROYECTO', 20, startY + 10);
  
  doc.setFontSize(9);
  setTxt(doc, COLORS.white);

  // Columna izquierda
  doc.text(`Proyecto: ${project.name}`, 20, startY + 18);
  doc.text(`Cliente: ${project.clientName || 'Sin especificar'}`, 20, startY + 25);
  doc.text(`Tipología: ${project.typology}`, 20, startY + 32);

  // Columna derecha
  doc.text(`Estado: ${project.status}`, pageWidth / 2, startY + 18);
  doc.text(`Inicio: ${fmtDate(project.startDate)}`, pageWidth / 2, startY + 25);
  if (project.location) doc.text(`Ubicación: ${project.location}`, pageWidth / 2, startY + 32);

  return startY + 42;
};

// ─── Resumen ejecutivo ─────────────────────────────────────────────────────────
const addExecutiveSummary = (
  doc: jsPDF, 
  totals: ProjectTotals,
  marketLabel?: string,
  startY: number = 60
): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxWidth = (pageWidth - 45) / 4;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  setTxt(doc, COLORS.white);
  doc.text('RESUMEN EJECUTIVO', 15, startY);

  startY += 8;

  const boxes = [
    { label: 'COSTO DIRECTO', value: fmtCurrency(totals.directCost), color: COLORS.accent },
    { label: 'COSTOS INDIRECTOS', value: fmtCurrency(totals.indirectCost + totals.adminCost + totals.personalCost), color: COLORS.warning },
    { label: 'PRESUPUESTO TOTAL', value: fmtCurrency(totals.totalBudget), color: COLORS.success },
    { label: marketLabel || 'DURACIÓN EST.', value: totals.estimatedDays > 0 ? `${Math.ceil(totals.estimatedDays)} días` : '—', color: COLORS.primary },
  ];

  boxes.forEach((box, i) => {
    const x = 15 + (i * (boxWidth + 5));
    
    setFill(doc, box.color);
    doc.roundedRect(x, startY, boxWidth, 22, 2, 2, 'F');
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    setTxt(doc, COLORS.white);
    doc.text(box.label, x + boxWidth / 2, startY + 8, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(box.value, x + boxWidth / 2, startY + 17, { align: 'center' });
  });

  return startY + 30;
};

// ─── Detalle de costos ──────────────────────────────────────────────────────────
const addCostBreakdown = (doc: jsPDF, totals: ProjectTotals, project: Project, startY: number): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  setTxt(doc, COLORS.white);
  doc.text('DESGLOSE DE COSTOS', 15, startY + 5);

  autoTable(doc, {
    startY: startY + 10,
    head: [['Concepto', '% del Directo', 'Monto (Q)']],
    body: [
      ['Materiales', `${totals.directCost > 0 ? ((totals.materialTotal / totals.directCost) * 100).toFixed(1) : 0}%`, fmtCurrency(totals.materialTotal)],
      ['Mano de Obra', `${totals.directCost > 0 ? ((totals.laborTotal / totals.directCost) * 100).toFixed(1) : 0}%`, fmtCurrency(totals.laborTotal)],
      ['Equipo', `${totals.directCost > 0 ? ((totals.equipmentTotal / totals.directCost) * 100).toFixed(1) : 0}%`, fmtCurrency(totals.equipmentTotal)],
      ['Desperdicio', `${totals.directCost > 0 ? ((totals.wasteTotal / totals.directCost) * 100).toFixed(1) : 0}%`, fmtCurrency(totals.wasteTotal)],
      ['IVA (12%)', '12%', fmtCurrency(totals.taxTotal)],
      ['Margen (15%)', '15%', fmtCurrency(totals.profitTotal)],
      ['Imprevistos (5%)', '5%', fmtCurrency(totals.contingencyTotal)],
    ],
    foot: [['TOTAL DIRECTO', '100%', fmtCurrency(totals.directCost)]],
    theme: 'striped',
    headStyles: { fillColor: COLORS.primary, fontStyle: 'bold', fontSize: 7 },
    footStyles: { fillColor: COLORS.secondary, textColor: COLORS.primary, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { halign: 'center', cellWidth: 35 },
      2: { halign: 'right', cellWidth: 'auto' }
    }
  });

  return (doc as any).lastAutoTable.finalY + 5;
};

// ─── Presupuesto completo (4 páginas) ────────────────────────────────────────────
export const generateBudgetPDF = (
  project: Project,
  budgetTree: BudgetLine[] | undefined,
  override?: TotalsOverride
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const totals = calculateProjectReportTotals(project, budgetTree, override);

  // Página 1 — Portada + Resumen
  addHeader(doc, 'PRESUPUESTO DE OBRA', `Ref: ${project.id?.slice(0, 8) || 'NUEVO'}`);
  let y = addProjectInfo(doc, project, 60);
  y = addExecutiveSummary(doc, totals, override?.marketLabel, y + 5);

  // Desglose de costos
  y = addCostBreakdown(doc, totals, project, y);

  // Página 2 — Detalle de Renglones
  doc.addPage();
  addHeader(doc, 'DETALLE DE RENGLONES', project.name);

  const tableRows = totals.lines.length > 0 
    ? totals.lines.map((line: LineResult, i: number) => [
        i + 1,
        line.code || '',
        line.description?.slice(0, 35) || '',
        line.unit || '',
        line.materialTotal.toFixed(2),
        line.laborTotal.toFixed(2),
        line.totalLine.toFixed(2),
      ])
    : project.items.map((item, index) => {
        const matSum = item.materials.reduce((acc, m) => acc + m.price * m.quantity, 0);
        const labSum = item.labor.reduce((acc, l) => acc + l.price * l.quantity, 0);
        const unitTotal = matSum + labSum;
        return [
          index + 1,
          item.code,
          item.description.slice(0, 35),
          item.unit,
          item.projectQuantity.toFixed(2),
          fmtCurrency(unitTotal),
          fmtCurrency(unitTotal * item.projectQuantity),
        ];
      });

  autoTable(doc, {
    startY: 58,
    head: [['#', 'Código', 'Descripción', 'Unidad', 'Cant.', 'P.Unit Q', 'Subtotal Q']],
    body: tableRows,
    foot: [['', '', '', '', '', 'TOTAL DIRECTO:', fmtCurrency(totals.directCost)]],
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, fontSize: 7, fontStyle: 'bold' },
    footStyles: { fillColor: COLORS.light, textColor: COLORS.primary, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 18 },
      2: { cellWidth: 55 },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 28, halign: 'right' },
    }
  });

  // Página 3 — Análisis de Precios Unitarios
  const projectMaterials = calculateProjectMaterials(project);
  
  if (projectMaterials.length > 0) {
    doc.addPage();
    addHeader(doc, 'ANÁLISIS DE PRECIOS UNITARIOS', project.name);

    const itemsToShow = totals.lines.length > 0 ? totals.lines : project.items;
    let currentY = 58;

    itemsToShow.slice(0, 6).forEach((item: any, idx: number) => {
      if (currentY > 240) {
        doc.addPage();
        addHeader(doc, 'ANÁLISIS DE PRECIOS UNITARIOS', project.name);
        currentY = 58;
      }

      setFill(doc, COLORS.primary);
      doc.roundedRect(15, currentY, pageWidth - 30, 10, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      setTxt(doc, COLORS.white);
      doc.text(`${item.code || ''} - ${item.description?.slice(0, 50) || item.name || ''}`, 20, currentY + 7);
      currentY += 12;

      const matRows = item.materials?.map((m: any) => [m.name, m.unit, m.quantity?.toString(), fmtCurrency(m.price), fmtCurrency(m.price * m.quantity)]) || [];
      const labRows = item.labor?.map((l: any) => [l.role, l.unit, l.quantity?.toString(), fmtCurrency(l.price), fmtCurrency(l.price * l.quantity)]) || [];

      autoTable(doc, {
        startY: currentY,
        head: [['Descripción', 'Unidad', 'Cant.', 'P. Unit.', 'Total']],
        body: [...matRows, ...labRows],
        theme: 'plain',
        headStyles: { fillColor: COLORS.white, textColor: COLORS.gray, fontSize: 6, fontStyle: 'bold' },
        styles: { fontSize: 6, cellPadding: 2 },
        margin: { left: 20, right: 20 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    });
  }

  // Página de RESUMEN DE MATERIALES
  if (projectMaterials.length > 0) {
    doc.addPage();
    addHeader(doc, 'RESUMEN DE MATERIALES', project.name);
    let matY = 55;

    const categories = [
      { key: 'concreto', label: 'CONCRETO', color: COLORS.gray },
      { key: 'acero', label: 'ACERO Y FERRETERÍA', color: COLORS.danger },
      { key: 'mamposteria', label: 'MAMPOSTERÍA', color: COLORS.secondary },
      { key: 'acabados', label: 'ACABADOS', color: COLORS.success },
      { key: 'instalaciones', label: 'INSTALACIONES', color: COLORS.accent },
      { key: 'varios', label: 'VARIOS', color: COLORS.gray },
    ];

    categories.forEach(cat => {
      const materialsInCat = projectMaterials.filter(m => m.category === cat.key);
      if (materialsInCat.length === 0) return;

      if (matY > 250) {
        doc.addPage();
        addHeader(doc, 'RESUMEN DE MATERIALES', project.name);
        matY = 55;
      }

      setFill(doc, cat.color);
      doc.roundedRect(15, matY, pageWidth - 30, 8, 1, 1, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      setTxt(doc, COLORS.white);
      doc.text(cat.label, 20, matY + 6);
      matY += 12;

      const matRows = materialsInCat.map(m => [
        m.name, m.unit,
        m.totalQuantity.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 3 })
      ]);

      autoTable(doc, {
        startY: matY,
        head: [['Material', 'Unidad', 'Cantidad Total']],
        body: matRows,
        theme: 'striped',
        headStyles: { fillColor: cat.color, fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 7, cellPadding: 3 },
        columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 25 }, 2: { cellWidth: 35, halign: 'right' } },
        margin: { left: 15, right: 15 }
      });

      matY = (doc as any).lastAutoTable.finalY + 10;
    });
  }

  // Página de Firmas
  doc.addPage();
  addHeader(doc, 'APROBACIÓN Y FIRMAS', project.name);
  let signY = 80;

  doc.setFontSize(9);
  setTxt(doc, COLORS.white);
  doc.text('El presente presupuesto ha sido elaborado de acuerdo a los estándares de la industria de construcción', pageWidth / 2, signY, { align: 'center' });
  doc.text('y está sujeto a las condiciones especificadas en el contrato de obra.', pageWidth / 2, signY + 6, { align: 'center' });

  signY += 40;
  const signBoxWidth = 70;
  const signBoxHeight = 45;

  setDraw(doc, COLORS.gray);
  doc.setLineWidth(0.3);
  doc.roundedRect(25, signY, signBoxWidth, signBoxHeight, 3, 3, 'S');
  doc.setFontSize(7);
  setTxt(doc, COLORS.white);
  doc.text('CONSTRUCTORA WM/M&S', 25 + signBoxWidth / 2, signY + 10, { align: 'center' });
  doc.line(35, signY + 32, 25 + signBoxWidth - 10, signY + 32);
  doc.text('Firma y Sello', 25 + signBoxWidth / 2, signY + 38, { align: 'center' });

  doc.roundedRect(pageWidth - 25 - signBoxWidth, signY, signBoxWidth, signBoxHeight, 3, 3, 'S');
  doc.text('CLIENTE', pageWidth - 25 - signBoxWidth / 2, signY + 10, { align: 'center' });
  doc.text(project.clientName || 'Sin especificar', pageWidth - 25 - signBoxWidth / 2, signY + 18, { align: 'center' });
  doc.line(pageWidth - 25 - signBoxWidth + 10, signY + 32, pageWidth - 35, signY + 32);
  doc.text('Firma de Aceptación', pageWidth - 25 - signBoxWidth / 2, signY + 38, { align: 'center' });

  signY += signBoxHeight + 20;
  doc.setFontSize(8);
  doc.text(`Presupuesto válido por 30 días · Elaborado: ${fmtDate()} · CONSTRUCTORA WM/M&S`, pageWidth / 2, signY, { align: 'center' });

  // Footers
  const totalPages = (doc as any).internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  doc.save(`Presupuesto_${project.name.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ─── Plantilla ejecutiva (compacta) ──────────────────────────────────────────────
export const generateBudgetPDFEjecutivo = (
  project: Project,
  budgetTree: BudgetLine[] | undefined,
  override?: TotalsOverride
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const totals = calculateProjectReportTotals(project, budgetTree, override);

  addHeader(doc, 'COTIZACIÓN EJECUTIVA', `Ref: ${project.id?.slice(0, 8) || 'NUEVO'}`);
  let y = addProjectInfo(doc, project, 60);
  y = addExecutiveSummary(doc, totals, override?.marketLabel, y + 5);

  // Tabla resumen de renglones
  autoTable(doc, {
    startY: y + 5,
    head: [['#', 'Descripción', 'Unid.', 'Cant.', 'P.Unit Q', 'Subtotal Q']],
    body: totals.lines.length > 0
      ? totals.lines.map((line: LineResult, i: number) => [
          i + 1,
          line.description?.slice(0, 40) || '',
          line.unit || '',
          line.materialTotal > 0 ? line.materialTotal.toFixed(2) : '—',
          fmtCurrency(line.unitCost),
          fmtCurrency(line.totalLine),
        ])
      : project.items.map((item, i) => {
          const u = item.materials.reduce((a, m) => a + m.price * m.quantity, 0) +
                    item.labor.reduce((a, l) => a + l.price * l.quantity, 0);
          return [i + 1, item.description.slice(0, 40), item.unit,
            item.projectQuantity.toFixed(2), fmtCurrency(u), fmtCurrency(u * item.projectQuantity)];
        }),
    foot: [['', '', '', '', 'TOTAL:', fmtCurrency(totals.directCost)]],
    theme: 'striped',
    headStyles: { fillColor: COLORS.primary, fontSize: 7, fontStyle: 'bold' },
    footStyles: { fillColor: COLORS.secondary, textColor: COLORS.primary, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 2.5 },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 65 }, 4: { halign: 'right' }, 5: { halign: 'right' } }
  });

  // Resumen final
  const finalY = Math.min((doc as any).lastAutoTable.finalY + 10, 250);
  setFill(doc, COLORS.light);
  doc.roundedRect(15, finalY, pageWidth - 30, 22, 2, 2, 'F');
  setTxt(doc, COLORS.gray);
  doc.setFontSize(7);
  doc.text(`Presupuesto válido por 30 días · ${override?.marketLabel || ''} · CONSTRUCTORA WM/M&S`, pageWidth / 2, finalY + 8, { align: 'center' });
  doc.text('Precios sujetos a variación según condiciones de mercado.', pageWidth / 2, finalY + 14, { align: 'center' });

  addFooter(doc, 1, 1);
  doc.save(`Cotizacion_Ejecutiva_${project.name.replace(/\s/g, '_')}.pdf`);
};

// ─── Cliente (solo resumen) ──────────────────────────────────────────────────────
export const generateBudgetPDFCliente = (
  project: Project,
  budgetTree: BudgetLine[] | undefined,
  override?: TotalsOverride
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const totals = calculateProjectReportTotals(project, budgetTree, override);

  addHeader(doc, 'PRESUPUESTO PARA CLIENTE', `Ref: ${project.id?.slice(0, 8) || 'NUEVO'}`);
  let y = addProjectInfo(doc, project, 60);
  y = addExecutiveSummary(doc, totals, override?.marketLabel, y + 5);

  y += 15;
  setFill(doc, COLORS.primary);
  doc.roundedRect(15, y, pageWidth - 30, 12, 2, 2, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  setTxt(doc, COLORS.white);
  doc.text('RESUMEN FINAL', 20, y + 7);

  y += 20;
  const boxWidth = (pageWidth - 45) / 2;

  setFill(doc, COLORS.success);
  doc.roundedRect(15, y, boxWidth - 5, 25, 2, 2, 'F');
  doc.setFontSize(7);
  setTxt(doc, COLORS.white);
  doc.text('PRESUPUESTO TOTAL', 20, y + 8);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtCurrency(totals.totalBudget), 20, y + 18);

  setFill(doc, COLORS.accent);
  doc.roundedRect(15 + boxWidth, y, boxWidth - 5, 25, 2, 2, 'F');
  doc.setFontSize(7);
  setTxt(doc, COLORS.white);
  doc.text('DURACIÓN ESTIMADA', 20 + boxWidth, y + 8);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`${totals.estimatedDays > 0 ? Math.ceil(totals.estimatedDays) : '—'} DÍAS`, 20 + boxWidth, y + 18);

  y += 55;
  setFill(doc, COLORS.light);
  doc.roundedRect(15, y, pageWidth - 30, 35, 2, 2, 'F');
  setTxt(doc, COLORS.gray);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('CONDICIONES:', 20, y + 8);
  doc.setFont('helvetica', 'normal');

  const conditions = [
    'El presente presupuesto incluye materiales (con IVA), mano de obra, impuestos y costos indirectos.',
    'La validez de este presupuesto es de 30 días a partir de la fecha de emisión.',
    'Los plazos de entrega están sujetos a disponibilidad de materiales y condiciones del sitio.',
    'Cualquier modificación en el alcance requerirá una nueva cotización.',
    'El pago se realizará según el avance de obra con facturas correspondientes.',
  ];
  conditions.forEach((cond, i) => {
    doc.setFontSize(6);
    doc.text(cond, 20, y + 16 + (i * 5));
  });

  // Firmas
  const signY = y + 60;
  const signBoxWidth = 80;
  const signBoxHeight = 40;

  setDraw(doc, COLORS.gray);
  doc.setLineWidth(0.3);
  doc.roundedRect(25, signY, signBoxWidth, signBoxHeight, 3, 3, 'S');
  doc.setFontSize(7);
  setTxt(doc, COLORS.white);
  doc.text('CONSTRUCTORA WM/M&S', 25 + signBoxWidth / 2, signY + 10, { align: 'center' });
  doc.line(35, signY + 30, 25 + signBoxWidth - 10, signY + 30);
  doc.text('Firma y Sello', 25 + signBoxWidth / 2, signY + 36, { align: 'center' });

  doc.roundedRect(pageWidth - 25 - signBoxWidth, signY, signBoxWidth, signBoxHeight, 3, 3, 'S');
  doc.text('CLIENTE', pageWidth - 25 - signBoxWidth / 2, signY + 10, { align: 'center' });
  doc.text(project.clientName || 'Sin especificar', pageWidth - 25 - signBoxWidth / 2, signY + 18, { align: 'center' });
  doc.line(pageWidth - 25 - signBoxWidth + 10, signY + 30, pageWidth - 35, signY + 30);
  doc.text('Firma de Aceptación', pageWidth - 25 - signBoxWidth / 2, signY + 36, { align: 'center' });

  addFooter(doc, 1, 1);
  doc.save(`Presupuesto_Cliente_${project.name.replace(/\s/g, '_')}.pdf`);
};

// ─── APU completo (análisis por renglón) ─────────────────────────────────────────
export const generateBudgetPDFAPU = (
  project: Project,
  budgetTree: BudgetLine[] | undefined,
  override?: TotalsOverride
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const totals = calculateProjectReportTotals(project, budgetTree, override);
  let pageNum = 1;

  addHeader(doc, 'ANÁLISIS DE PRECIOS UNITARIOS', project.name);
  let y = addProjectInfo(doc, project, 60);
  y = addExecutiveSummary(doc, totals, override?.marketLabel, y + 5);

  // Índice
  setFill(doc, COLORS.light);
  doc.roundedRect(15, y + 5, pageWidth - 30, 8, 2, 2, 'F');
  setTxt(doc, COLORS.primary);
  doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('ÍNDICE DE RENGLONES', 20, y + 11);
  y += 18;

  const itemsToShow = totals.lines.length > 0 ? totals.lines : project.items;

  itemsToShow.forEach((item: any, i) => {
    const unitCost = item.totalLine || (item.unitCost || 0);
    const subtotal = item.totalLine || (item.unitCost * item.projectQuantity);
    setTxt(doc, COLORS.gray);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(`${i + 1}. ${item.description?.slice(0, 55) || item.name || ''}`, 20, y);
    doc.text(fmtCurrency(subtotal), pageWidth - 20, y, { align: 'right' });
    y += 6;
    if (y > 260) { addFooter(doc, pageNum, 99); doc.addPage(); pageNum++; addHeader(doc, 'APU — ÍNDICE', project.name); y = 60; }
  });

  // Páginas detalladas por renglón
  itemsToShow.forEach((item: any, idx) => {
    addFooter(doc, pageNum, 99); doc.addPage(); pageNum++;
    addHeader(doc, `APU ${idx + 1}/${itemsToShow.length}`, project.name);

    let cy = 58;
    setFill(doc, COLORS.primary);
    doc.roundedRect(15, cy, pageWidth - 30, 14, 2, 2, 'F');
    setTxt(doc, COLORS.secondary);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(`${item.code || ''} — ${item.description?.slice(0, 60) || item.name || ''}`, 20, cy + 6);
    setTxt(doc, COLORS.white);
    doc.setFontSize(7);
    doc.text(`Unidad: ${item.unit || 'GL'} | Cantidad: ${item.projectQuantity || 1} | Categoría: ${item.category || '—'}`, 20, cy + 12);
    cy += 18;

    // Materiales
    if (item.materials?.length) {
      const matRows = item.materials.map((m: any) => [
        m.name, m.unit, m.quantity?.toFixed(3), fmtCurrency(m.price), fmtCurrency(m.price * m.quantity)
      ]);

      autoTable(doc, {
        startY: cy,
        head: [['MATERIALES', 'Unid.', 'Cant./unid.', 'P.Unit Q', 'Subtotal Q']],
        body: matRows,
        theme: 'grid',
        headStyles: { fillColor: COLORS.accent, fontSize: 7, fontStyle: 'bold' },
        styles: { fontSize: 7, cellPadding: 2.5 },
        margin: { left: 15, right: 15 }
      });
      cy = (doc as any).lastAutoTable.finalY + 4;
    }

    // Mano de obra
    if (item.labor?.length) {
      const labRows = item.labor.map((l: any) => [
        l.role, l.unit, l.quantity?.toFixed(3), fmtCurrency(l.price), fmtCurrency(l.price * l.quantity)
      ]);

      autoTable(doc, {
        startY: cy,
        head: [['MANO DE OBRA', 'Unid.', 'Cant./unid.', 'P.Unit Q', 'Subtotal Q']],
        body: labRows,
        theme: 'grid',
        headStyles: { fillColor: COLORS.dark, fontSize: 7, fontStyle: 'bold' },
        styles: { fontSize: 7, cellPadding: 2.5 },
        margin: { left: 15, right: 15 }
      });
      cy = (doc as any).lastAutoTable.finalY + 4;
    }

    // Resumen del renglón
    const matTotal = item.materials?.reduce((a: number, m: any) => a + m.price * m.quantity, 0) || 0;
    const labTotal = item.labor?.reduce((a: number, l: any) => a + l.price * l.quantity, 0) || 0;
    const unitCost = matTotal + labTotal;
    const workers = Math.max(1, item.labor?.reduce((s: number, l: any) => s + l.quantity, 0) || 1);
    const realDays = Math.ceil(((item.projectQuantity || 1) * (item.durationDays || 1)) / workers);

    setFill(doc, COLORS.secondary);
    doc.roundedRect(15, cy, pageWidth - 30, 18, 2, 2, 'F');
    setTxt(doc, COLORS.primary);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(`Costo unitario: ${fmtCurrency(unitCost)}/${item.unit || 'un'}`, 20, cy + 7);
    doc.text(`Subtotal: ${fmtCurrency(unitCost * (item.projectQuantity || 1))}`, 20, cy + 14);
    doc.text(`Duración: ${realDays} días (${workers} obreros)`, pageWidth / 2, cy + 7);
    doc.text(`Rendimiento: ${item.durationDays || 1} días/${item.unit || 'un'}`, pageWidth / 2, cy + 14);
  });

  // Página de totales
  addFooter(doc, pageNum, 99); doc.addPage(); pageNum++;
  addHeader(doc, 'RESUMEN FINAL', project.name);
  addExecutiveSummary(doc, totals, override?.marketLabel, 60);
  
  addFooter(doc, pageNum, pageNum);

  const total = pageNum;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    addFooter(doc, i, total);
  }

  doc.save(`APU_Completo_${project.name.replace(/\s/g, '_')}.pdf`);
};

// ─── Informe de avance ──────────────────────────────────────────────────────────
export const generateProgressReport = (
  project: Project,
  budgetTree: BudgetLine[] | undefined,
  transactions: any[] = [],
  override?: TotalsOverride
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const totals = calculateProjectReportTotals(project, budgetTree, override);

  addHeader(doc, 'INFORME DE AVANCE', project.name);
  let y = addProjectInfo(doc, project, 60);

  // Indicadores de avance
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  setTxt(doc, COLORS.white);
  doc.text('INDICADORES DE AVANCE', 15, y + 5);

  y += 12;

  const progress = project.progress || 0;
  const executedCost = project.directCosts || 0;
  const financialProgress = totals.directCost > 0 ? Math.min(100, (executedCost / totals.directCost) * 100) : 0;

  // Barra de progreso físico
  setFill(doc, COLORS.primary);
  doc.roundedRect(15, y, pageWidth - 30, 20, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  setTxt(doc, COLORS.white);
  doc.text('Avance Físico:', 20, y + 8);
  doc.text(`${progress}%`, pageWidth - 25, y + 8, { align: 'right' });
  setFill(doc, COLORS.accent);
  doc.roundedRect(20, y + 12, (pageWidth - 50) * Math.min(progress, 100) / 100, 5, 1, 1, 'F');
  setDraw(doc, COLORS.gray);
  doc.roundedRect(20, y + 12, pageWidth - 50, 5, 1, 1, 'S');

  y += 25;

  // Barra de progreso financiero
  setFill(doc, COLORS.primary);
  doc.roundedRect(15, y, pageWidth - 30, 20, 2, 2, 'F');
  doc.text('Avance Financiero:', 20, y + 8);
  doc.text(`${financialProgress.toFixed(1)}%`, pageWidth - 25, y + 8, { align: 'right' });

  const progressColor = financialProgress > 100 ? COLORS.danger : COLORS.success;
  setFill(doc, progressColor);
  doc.roundedRect(20, y + 12, (pageWidth - 50) * Math.min(financialProgress, 100) / 100, 5, 1, 1, 'F');
  setDraw(doc, COLORS.gray);
  doc.roundedRect(20, y + 12, pageWidth - 50, 5, 1, 1, 'S');

  y += 30;

  // Resumen financiero
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  setTxt(doc, COLORS.white);
  doc.text('RESUMEN FINANCIERO', 15, y);

  const executedIndirect = executedCost * ((project.indirectCosts || 15) / 100);
  const executedAdmin = executedCost * ((project.administrativeCosts || 5) / 100);
  const executedPersonal = executedCost * ((project.personalCosts || 10) / 100);
  const executedTotal = executedCost + executedIndirect + executedAdmin + executedPersonal;

  autoTable(doc, {
    startY: y + 5,
    head: [['Concepto', 'Presupuestado', 'Ejecutado', 'Diferencia']],
    body: [
      ['Costo Directo', fmtCurrency(totals.directCost), fmtCurrency(executedCost), fmtCurrency(totals.directCost - executedCost)],
      ['Costos Indirectos', fmtCurrency(totals.indirectCost), fmtCurrency(executedIndirect), fmtCurrency(totals.indirectCost - executedIndirect)],
      ['Gastos Adm.', fmtCurrency(totals.adminCost), fmtCurrency(executedAdmin), fmtCurrency(totals.adminCost - executedAdmin)],
      ['Gastos Personal', fmtCurrency(totals.personalCost), fmtCurrency(executedPersonal), fmtCurrency(totals.personalCost - executedPersonal)],
      ['TOTAL', fmtCurrency(totals.totalBudget), fmtCurrency(executedTotal), fmtCurrency(totals.totalBudget - executedTotal)],
    ],
    theme: 'striped',
    headStyles: { fillColor: COLORS.primary, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 4 },
  });

  addFooter(doc, 1, 1);
  doc.save(`Informe_Avance_${project.name.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ─── CSV ──────────────────────────────────────────────────────────────────────────
export const generateBudgetCSV = (
  project: Project,
  budgetTree: BudgetLine[] | undefined,
  override?: TotalsOverride
) => {
  const totals = calculateProjectReportTotals(project, budgetTree, override);

  const headers = ['Código', 'Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Subtotal', 'Categoría'];
  const rows = totals.lines.length > 0
    ? totals.lines.map((line: LineResult) => [
        line.code,
        `"${line.description || ''}"`,
        line.unit,
        line.materialTotal > 0 ? line.materialTotal.toFixed(2) : '—',
        line.unitCost.toFixed(2),
        line.totalLine.toFixed(2),
        '',
      ])
    : project.items.map(item => {
        const matSum = item.materials.reduce((acc, m) => acc + m.price * m.quantity, 0);
        const labSum = item.labor.reduce((acc, l) => acc + l.price * l.quantity, 0);
        const unitTotal = matSum + labSum;
        return [
          item.code, `"${item.description}"`, item.unit,
          item.projectQuantity.toFixed(2), unitTotal.toFixed(2),
          (unitTotal * item.projectQuantity).toFixed(2), item.category
        ];
      });

  // Resumen
  rows.push(['', '', '', '', '', '', '']);
  rows.push(['RESUMEN', '', '', '', '', '', '']);
  rows.push(['Costo Directo', '', '', '', '', totals.directCost.toFixed(2), '']);
  rows.push(['IVA (12%)', '', '', '', '', totals.taxTotal.toFixed(2), '']);
  rows.push(['Margen (15%)', '', '', '', '', totals.profitTotal.toFixed(2), '']);
  rows.push(['Imprevistos (5%)', '', '', '', '', totals.contingencyTotal.toFixed(2), '']);
  rows.push(['Costos Indirectos', '', '', '', '', totals.indirectCost.toFixed(2), '']);
  rows.push(['Gastos Admin', '', '', '', '', totals.adminCost.toFixed(2), '']);
  rows.push(['Gastos Personal', '', '', '', '', totals.personalCost.toFixed(2), '']);
  rows.push(['TOTAL PRESUPUESTO', '', '', '', '', totals.totalBudget.toFixed(2), '']);

  // Materiales
  const projectMaterials = calculateProjectMaterials(project);
  if (projectMaterials.length > 0) {
    rows.push(['', '', '', '', '', '', '']);
    rows.push(['RESUMEN DE MATERIALES', '', '', '', '', '', '']);
    rows.push(['Material', 'Unidad', 'Cantidad Total', 'Categoría', '', '', '']);
    projectMaterials.forEach(mat => rows.push([mat.name, mat.unit, mat.totalQuantity.toFixed(2), mat.category, '', '', '']));
  }

  const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Presupuesto_${project.name.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ─── JSON ─────────────────────────────────────────────────────────────────────────
export const generateBudgetJSON = (
  project: Project,
  budgetTree: BudgetLine[] | undefined,
  override?: TotalsOverride
) => {
  const totals = calculateProjectReportTotals(project, budgetTree, override);
  const projectMaterials = calculateProjectMaterials(project);

  const json = {
    metadata: {
      exportedAt: new Date().toISOString(),
      projectName: project.name,
      clientName: project.clientName,
      typology: project.typology,
      status: project.status,
      engineVersion: '2.0.0',
      marketLevel: project.marketLevel?.name || 'N/A',
      slabType: project.slabType?.name || 'N/A',
    },
    totals: {
      directCost: totals.directCost,
      materialsTotal: totals.materialTotal,
      laborTotal: totals.laborTotal,
      equipmentTotal: totals.equipmentTotal,
      wasteTotal: totals.wasteTotal,
      taxAmount: totals.taxTotal,
      profitAmount: totals.profitTotal,
      contingencyAmount: totals.contingencyTotal,
      indirectCost: totals.indirectCost,
      adminCost: totals.adminCost,
      personalCost: totals.personalCost,
      totalBudget: totals.totalBudget,
      estimatedDays: totals.estimatedDays,
      costPerM2: totals.costPerM2,
    },
    items: totals.lines.map((line: LineResult, i: number) => ({
      index: i + 1,
      code: line.code,
      description: line.description,
      unit: line.unit,
      quantity: 1,
      category: '',
      materialUnitCost: line.materialCost,
      laborUnitCost: line.laborCost,
      materialTotal: line.materialTotal,
      laborTotal: line.laborTotal,
      totalLine: line.totalLine,
    })),
    materialsSummary: projectMaterials.map(m => ({
      name: m.name, unit: m.unit, totalQuantity: m.totalQuantity, category: m.category
    })),
  };

  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Presupuesto_${project.name.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ─── BOM ──────────────────────────────────────────────────────────────────────────
export const generateBOM = (project: Project) => {
  const materialsMap: Record<string, { name: string; unit: string; totalQty: number; unitCost: number; totalCost: number }> = {};

  project.items.forEach(item => {
    (item.materials || []).forEach(mat => {
      const key = mat.name;
      const qty = mat.quantity * (item.projectQuantity || 1);
      const cost = mat.price * qty;
      if (materialsMap[key]) {
        materialsMap[key].totalQty += qty;
        materialsMap[key].totalCost += cost;
      } else {
        materialsMap[key] = { name: mat.name, unit: mat.unit, totalQty: qty, unitCost: mat.price, totalCost: cost };
      }
    });
  });

  const bomRows = Object.values(materialsMap).sort((a, b) => a.name.localeCompare(b.name));
  const totalCost = bomRows.reduce((s, r) => s + r.totalCost, 0);

  const bomCsv = [
    ['BILL OF MATERIALS (BOM)', '', '', '', ''],
    [`Proyecto: ${project.name}`, '', '', '', ''],
    [`Cliente: ${project.clientName}`, '', '', '', ''],
    [`Fecha: ${new Date().toLocaleDateString('es-GT')}`, '', '', '', ''],
    [],
    ['#', 'Material', 'Unidad', 'Cantidad Total', 'Costo Unit. (Q)', 'Costo Total (Q)'],
    ...bomRows.map((r, i) => [i + 1, `"${r.name}"`, r.unit, r.totalQty.toFixed(2), r.unitCost.toFixed(2), r.totalCost.toFixed(2)]),
    [],
    ['', '', '', 'TOTAL MATERIALES', '', totalCost.toFixed(2)],
  ].map(e => e.join(',')).join('\n');

  const blob = new Blob(['\ufeff' + bomCsv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `BOM_${project.name.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ─── Helpers internos ─────────────────────────────────────────────────────────────
const calculateProjectMaterials = (project: Project) => {
  const summary: Record<string, { name: string; unit: string; totalQuantity: number; category: string }> = {};
  project.items.forEach(item => {
    const category = item.category;
    const materialsConfig = MATERIALS_BY_CATEGORY[category] || MATERIALS_BY_CATEGORY['Varios'] || [];
    materialsConfig.forEach(mat => {
      const key = mat.materialName;
      const totalQuantity = mat.quantity * item.projectQuantity;
      if (summary[key]) {
        summary[key].totalQuantity += totalQuantity;
      } else {
        summary[key] = { name: mat.materialName, unit: mat.unit, totalQuantity, category: mat.category };
      }
    });
  });
  return Object.values(summary).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
};

// ─── Informe Físico-Financiero con membrete y firmas ─────────────────────────
export const generatePhysicalFinancialPDF = (
  project: any,
  items: Array<{ code: string; description: string; unit: string; quantity: number; plannedCost: number; actualCost: number; duration: number; startDay: number; endDay: number; progress: number }>
) => {
  const doc = new jsPDF('landscape');
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // ── Letterhead ──
  setFill(doc, COLORS.primary);
  doc.rect(0, 0, pw, 45, 'F');

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  setTxt(doc, COLORS.secondary);
  doc.text('CONSTRUCTORA WM / M&S', pw / 2, 18, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  setTxt(doc, COLORS.white);
  doc.text('Sistema de Gestión de Obra Profesional', pw / 2, 28, { align: 'center' });
  doc.text(`Reporte Físico-Financiero · ${new Date().toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' })}`, pw / 2, 37, { align: 'center' });

  // ── Project info ──
  setTxt(doc, COLORS.dark);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(project?.name || 'Proyecto', 15, 55);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  setTxt(doc, COLORS.gray);
  doc.text(`Estado: ${project?.status || 'N/A'} | ${items.length} renglones | Generado: ${new Date().toLocaleString('es-GT')}`, 15, 62);

  // ── Summary bar ──
  const totalPlanned = items.reduce((s, i) => s + i.plannedCost, 0);
  const totalActual = items.reduce((s, i) => s + i.actualCost, 0);
  const overallProgress = items.length > 0 ? Math.round(items.reduce((s, i) => s + i.progress, 0) / items.length) : 0;

  doc.setFillColor(240, 240, 245);
  doc.rect(15, 66, pw - 30, 14, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  setTxt(doc, COLORS.dark);
  doc.text(`Planificado: Q${totalPlanned.toLocaleString()}`, 20, 75);
  doc.text(`Real: Q${totalActual.toLocaleString()}`, 80, 75);
  doc.text(`Avance: ${overallProgress}%`, 160, 75);
  doc.text(`Renglones: ${items.length}`, 220, 75);

  // ── Data table ──
  autoTable(doc, {
    startY: 84,
    head: [['Código', 'Descripción', 'Und', 'Cantidad', 'Costo Plan.', 'Costo Real', 'Duración', 'Inicio', 'Fin', 'Avance (%)']],
    body: items.map(i => [
      i.code,
      i.description,
      i.unit,
      i.quantity,
      fmtCurrency(i.plannedCost),
      fmtCurrency(i.actualCost),
      `${i.duration}d`,
      `día ${i.startDay}`,
      `día ${i.endDay}`,
      `${i.progress}%`,
    ]),
    foot: [[
      { content: 'TOTALES', colSpan: 4, styles: { fontStyle: 'bold' } },
      { content: fmtCurrency(totalPlanned), styles: { fontStyle: 'bold' } },
      { content: fmtCurrency(totalActual), styles: { fontStyle: 'bold', textColor: totalActual > totalPlanned ? [239, 68, 68] : [16, 185, 129] } },
      { content: '', styles: { fontStyle: 'bold' } },
      { content: '', styles: { fontStyle: 'bold' } },
      { content: '', styles: { fontStyle: 'bold' } },
      { content: `${overallProgress}%`, styles: { fontStyle: 'bold' } },
    ]],
    theme: 'striped',
    headStyles: { fillColor: COLORS.primary, fontStyle: 'bold', fontSize: 7 },
    footStyles: { fillColor: [248, 250, 252], fontStyle: 'bold', fontSize: 7 },
    styles: { fontSize: 7, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 12 },
      3: { cellWidth: 16, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 18, halign: 'center' },
      7: { cellWidth: 16, halign: 'center' },
      8: { cellWidth: 16, halign: 'center' },
      9: { cellWidth: 20, halign: 'center' },
    },
  });

  // ── Signature fields ──
  const lastY = (doc as any).lastAutoTable?.finalY || 84;
  const sigY = Math.max(lastY + 20, ph - 80);

  setDraw(doc, COLORS.gray);
  doc.line(30, sigY, 130, sigY);
  doc.line(pw - 30, sigY, pw - 130, sigY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  setTxt(doc, COLORS.gray);
  doc.text('Firma del Contratista', 80, sigY + 6, { align: 'center' });
  doc.text('Firma del Supervisor', pw - 80, sigY + 6, { align: 'center' });

  doc.setFontSize(6);
  setTxt(doc, COLORS.gray);
  doc.text('Nombre: _________________________', 80, sigY + 13, { align: 'center' });
  doc.text('Nombre: _________________________', pw - 80, sigY + 13, { align: 'center' });
  doc.text('Fecha: __________________________', 80, sigY + 19, { align: 'center' });
  doc.text('Fecha: __________________________', pw - 80, sigY + 19, { align: 'center' });

  // ── Footer ──
  addFooter(doc, 1, 1);

  doc.save(`Fisico_Financiero_${(project?.name || 'proyecto').replace(/\s/g, '_')}.pdf`);
};

const addFooter = (doc: jsPDF, pageNum: number, totalPages: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  setDraw(doc, COLORS.gray);
  doc.setLineWidth(0.5);
  doc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20);

  doc.setFontSize(7);
  setTxt(doc, COLORS.gray);
  doc.setFont('helvetica', 'normal');
  doc.text('Este documento es generado por el Sistema ERP CONSTRUCTORA WM/M&S', 15, pageHeight - 14);
  doc.text('Presupuesto sujeto a revisión según condiciones de mercado', 15, pageHeight - 10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - 15, pageHeight - 12, { align: 'right' });
};