/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Sistema de Informes PDF Profesionales - CONSTRUCTORA WM/M&S
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Project } from '../constants';

// Colores corporativos
const COLORS = {
  primary: [15, 23, 42],      // Slate-900
  secondary: [245, 158, 11],  // Amber-500
  accent: [59, 130, 246],     // Blue-500
  success: [16, 185, 129],    // Emerald-500
  warning: [251, 146, 60],    // Orange-400
  danger: [239, 68, 68],      // Red-500
  light: [248, 250, 252],     // Slate-50
  dark: [30, 41, 59],         // Slate-800
  white: [255, 255, 255],
  gray: [100, 116, 139],      // Slate-500
};

// Helper para formatear moneda
const fmtCurrency = (n: number) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Helper para fecha formateada
const fmtDate = (date?: string) => {
  if (!date) return new Date().toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' });
  return new Date(date).toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' });
};

// Calcular totales del proyecto
const calculateProjectTotals = (project: Project) => {
  const directCost = project.items.reduce((acc, item) => {
    const matSum = item.materials.reduce((m, mat) => m + (mat.price * mat.quantity), 0);
    const labSum = item.labor.reduce((l, lab) => l + (lab.price * lab.quantity), 0);
    return acc + (matSum + labSum) * item.projectQuantity;
  }, 0);

  const materialsTotal = project.items.reduce((acc, item) => {
    const mat = item.materials.reduce((m, mat) => m + (mat.price * mat.quantity), 0);
    return acc + (mat * item.projectQuantity);
  }, 0);

  const laborTotal = project.items.reduce((acc, item) => {
    const lab = item.labor.reduce((l, lab) => l + (lab.price * lab.quantity), 0);
    return acc + (lab * item.projectQuantity);
  }, 0);

  const indirectCost = directCost * ((project.indirectCosts || 15) / 100);
  const adminCost = directCost * ((project.administrativeCosts || 5) / 100);
  const personalCost = directCost * ((project.personalCosts || 10) / 100);
  const totalBudget = directCost + indirectCost + adminCost + personalCost;

  const estimatedDays = project.items.reduce((acc, item) => acc + (item.durationDays || 1) * item.projectQuantity, 0);

  return { directCost, materialsTotal, laborTotal, indirectCost, adminCost, personalCost, totalBudget, estimatedDays };
};

// Agregar encabezado corporativo
const addHeader = (doc: jsPDF, title: string, subtitle?: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Fondo del header
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Línea decorativa secundaria
  doc.setFillColor(...COLORS.secondary);
  doc.rect(0, 45, pageWidth, 3, 'F');
  
  // Logo / Nombre empresa
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('CONSTRUCTORA WM/M&S', 15, 22);
  
  // Slogan
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.secondary);
  doc.text('CONSTRUYENDO EL FUTURO', 15, 32);
  
  // Título del documento
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), pageWidth - 15, 22, { align: 'right' });
  
  if (subtitle) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, pageWidth - 15, 30, { align: 'right' });
  }
  
  // Fecha
  doc.setFontSize(8);
  doc.text(`Fecha: ${fmtDate()}`, pageWidth - 15, 38, { align: 'right' });
};

// Agregar pie de página
const addFooter = (doc: jsPDF, pageNum: number, totalPages: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Línea superior del footer
  doc.setDrawColor(...COLORS.secondary);
  doc.setLineWidth(0.5);
  doc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20);
  
  // Texto del footer
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.gray);
  doc.setFont('helvetica', 'normal');
  doc.text('Este documento es generado por el Sistema ERP CONSTRUCTORA WM/M&S', 15, pageHeight - 14);
  doc.text('Presupuesto sujeto a revisión según condiciones de mercado', 15, pageHeight - 10);
  
  // Número de página
  doc.setFont('helvetica', 'bold');
  doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - 15, pageHeight - 12, { align: 'right' });
};

// Agregar sección de información del proyecto
const addProjectInfo = (doc: jsPDF, project: Project, startY: number): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(15, startY, pageWidth - 30, 35, 3, 3, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('DATOS DEL PROYECTO', 20, startY + 10);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.dark);
  
  // Columna izquierda
  doc.text(`Proyecto: ${project.name}`, 20, startY + 18);
  doc.text(`Cliente: ${project.clientName || 'Sin especificar'}`, 20, startY + 25);
  doc.text(`Tipología: ${project.typology}`, 20, startY + 32);
  
  // Columna derecha
  doc.text(`Estado: ${project.status}`, pageWidth / 2, startY + 18);
  doc.text(`Inicio: ${fmtDate(project.startDate)}`, pageWidth / 2, startY + 25);
  if (project.location) {
    doc.text(`Ubicación: ${project.location}`, pageWidth / 2, startY + 32);
  }
  
  return startY + 42;
};

// Agregar resumen ejecutivo
const addExecutiveSummary = (doc: jsPDF, project: Project, totals: ReturnType<typeof calculateProjectTotals>, startY: number): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxWidth = (pageWidth - 45) / 4;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('RESUMEN EJECUTIVO', 15, startY);
  
  startY += 8;
  
  // Cajas de resumen
  const boxes = [
    { label: 'COSTO DIRECTO', value: fmtCurrency(totals.directCost), color: COLORS.accent },
    { label: 'COSTOS INDIRECTOS', value: fmtCurrency(totals.indirectCost + totals.adminCost + totals.personalCost), color: COLORS.warning },
    { label: 'PRESUPUESTO TOTAL', value: fmtCurrency(totals.totalBudget), color: COLORS.success },
    { label: 'DURACIÓN EST.', value: `${Math.ceil(totals.estimatedDays)} días`, color: COLORS.primary },
  ];
  
  boxes.forEach((box, i) => {
    const x = 15 + (i * (boxWidth + 5));
    
    doc.setFillColor(...box.color);
    doc.roundedRect(x, startY, boxWidth, 22, 2, 2, 'F');
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.white);
    doc.text(box.label, x + boxWidth / 2, startY + 8, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(box.value, x + boxWidth / 2, startY + 17, { align: 'center' });
  });
  
  return startY + 30;
};

// Generar PDF de Presupuesto Ejecutivo
export const generateBudgetPDF = (project: Project) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const totals = calculateProjectTotals(project);
  
  // Página 1 - Portada y Resumen
  addHeader(doc, 'PRESUPUESTO DE OBRA', `Ref: ${project.id?.slice(0, 8) || 'NUEVO'}`);
  
  let y = 60;
  y = addProjectInfo(doc, project, y);
  y = addExecutiveSummary(doc, project, totals, y + 5);
  
  // Desglose de costos
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('DESGLOSE DE COSTOS', 15, y + 5);
  
  autoTable(doc, {
    startY: y + 10,
    head: [['Concepto', 'Porcentaje', 'Monto (Q)']],
    body: [
      ['Materiales', `${((totals.materialsTotal / totals.directCost) * 100).toFixed(1)}%`, fmtCurrency(totals.materialsTotal)],
      ['Mano de Obra', `${((totals.laborTotal / totals.directCost) * 100).toFixed(1)}%`, fmtCurrency(totals.laborTotal)],
      ['Costos Indirectos', `${project.indirectCosts || 15}%`, fmtCurrency(totals.indirectCost)],
      ['Gastos Administrativos', `${project.administrativeCosts || 5}%`, fmtCurrency(totals.adminCost)],
      ['Gastos de Personal', `${project.personalCosts || 10}%`, fmtCurrency(totals.personalCost)],
    ],
    foot: [['TOTAL PRESUPUESTO', '100%', fmtCurrency(totals.totalBudget)]],
    theme: 'striped',
    headStyles: { fillColor: COLORS.primary, fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: COLORS.secondary, textColor: COLORS.primary, fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: 'center', cellWidth: 40 },
      2: { halign: 'right', cellWidth: 'auto' }
    }
  });
  
  // Página 2 - Detalle de Renglones
  doc.addPage();
  addHeader(doc, 'DETALLE DE RENGLONES', project.name);
  
  const tableRows = project.items.map((item, index) => {
    const matSum = item.materials.reduce((acc, m) => acc + (m.price * m.quantity), 0);
    const labSum = item.labor.reduce((acc, l) => acc + (l.price * l.quantity), 0);
    const unitTotal = matSum + labSum;
    const subTotal = unitTotal * item.projectQuantity;
    
    return [
      index + 1,
      item.code,
      item.description.slice(0, 35),
      item.unit,
      item.projectQuantity.toFixed(2),
      fmtCurrency(unitTotal),
      fmtCurrency(subTotal)
    ];
  });

  autoTable(doc, {
    startY: 58,
    head: [['#', 'Código', 'Descripción', 'Unidad', 'Cantidad', 'Precio Unit.', 'Subtotal']],
    body: tableRows,
    foot: [['', '', '', '', '', 'TOTAL DIRECTO:', fmtCurrency(totals.directCost)]],
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, fontStyle: 'bold', fontSize: 7 },
    footStyles: { fillColor: COLORS.light, textColor: COLORS.primary, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 18 },
      2: { cellWidth: 55 },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
    }
  });
  
  // Página 3 - Detalle de Materiales por Renglón (si hay muchos items)
  if (project.items.length > 0) {
    doc.addPage();
    addHeader(doc, 'ANÁLISIS DE PRECIOS UNITARIOS', project.name);
    
    let currentY = 58;
    
    project.items.slice(0, 6).forEach((item, idx) => {
      if (currentY > 240) {
        doc.addPage();
        addHeader(doc, 'ANÁLISIS DE PRECIOS UNITARIOS', project.name);
        currentY = 58;
      }
      
      // Título del renglón
      doc.setFillColor(...COLORS.light);
      doc.roundedRect(15, currentY, pageWidth - 30, 10, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.primary);
      doc.text(`${item.code} - ${item.description}`, 20, currentY + 7);
      doc.text(`(${item.unit})`, pageWidth - 20, currentY + 7, { align: 'right' });
      
      currentY += 12;
      
      // Tabla de materiales
      const matRows = item.materials.map(m => [m.name, m.unit, m.quantity.toString(), fmtCurrency(m.price), fmtCurrency(m.price * m.quantity)]);
      const labRows = item.labor.map(l => [l.role, l.unit, l.quantity.toString(), fmtCurrency(l.price), fmtCurrency(l.price * l.quantity)]);
      
      autoTable(doc, {
        startY: currentY,
        head: [['Descripción', 'Unidad', 'Cant.', 'P. Unit.', 'Total']],
        body: [...matRows, ...labRows],
        theme: 'plain',
        headStyles: { fillColor: COLORS.white, textColor: COLORS.gray, fontSize: 6, fontStyle: 'bold' },
        styles: { fontSize: 6, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 60 },
          4: { halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: 20, right: 20 }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 8;
    });
  }
  
  // Página de Firmas
  doc.addPage();
  addHeader(doc, 'APROBACIÓN Y FIRMAS', project.name);
  
  let signY = 80;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.dark);
  doc.text('El presente presupuesto ha sido elaborado de acuerdo a los estándares de la industria de construcción', pageWidth / 2, signY, { align: 'center' });
  doc.text('y está sujeto a las condiciones especificadas en el contrato de obra.', pageWidth / 2, signY + 6, { align: 'center' });
  
  signY += 40;
  
  // Cajas de firma
  const signBoxWidth = 70;
  const signBoxHeight = 45;
  
  // Firma Contratista
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.3);
  doc.roundedRect(25, signY, signBoxWidth, signBoxHeight, 3, 3, 'S');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.gray);
  doc.text('CONSTRUCTORA WM/M&S', 25 + signBoxWidth / 2, signY + 10, { align: 'center' });
  doc.line(35, signY + 32, 25 + signBoxWidth - 10, signY + 32);
  doc.text('Firma y Sello', 25 + signBoxWidth / 2, signY + 38, { align: 'center' });
  
  // Firma Cliente
  doc.roundedRect(pageWidth - 25 - signBoxWidth, signY, signBoxWidth, signBoxHeight, 3, 3, 'S');
  doc.text('CLIENTE', pageWidth - 25 - signBoxWidth / 2, signY + 10, { align: 'center' });
  doc.text(project.clientName || 'Sin especificar', pageWidth - 25 - signBoxWidth / 2, signY + 18, { align: 'center' });
  doc.line(pageWidth - 25 - signBoxWidth + 10, signY + 32, pageWidth - 35, signY + 32);
  doc.text('Firma de Aceptación', pageWidth - 25 - signBoxWidth / 2, signY + 38, { align: 'center' });
  
  // Fecha de validez
  signY += signBoxHeight + 20;
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);
  doc.text(`Presupuesto válido por 30 días a partir del ${fmtDate()}`, pageWidth / 2, signY, { align: 'center' });
  
  // Agregar footers a todas las páginas
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  doc.save(`Presupuesto_${project.name.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

// Generar Informe de Avance de Proyecto
export const generateProgressReport = (project: Project, transactions: any[] = []) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const totals = calculateProjectTotals(project);
  
  addHeader(doc, 'INFORME DE AVANCE', project.name);
  
  let y = 60;
  y = addProjectInfo(doc, project, y);
  
  // Indicadores de Avance
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('INDICADORES DE AVANCE', 15, y + 5);
  
  y += 12;
  
  const progress = project.progress || 0;
  const executedCost = project.directCosts || 0;
  const financialProgress = totals.directCost > 0 ? Math.min(100, (executedCost / totals.directCost) * 100) : 0;
  
  // Barra de progreso físico
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(15, y, pageWidth - 30, 20, 2, 2, 'F');
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Avance Físico:', 20, y + 8);
  doc.text(`${progress}%`, pageWidth - 25, y + 8, { align: 'right' });
  
  doc.setFillColor(...COLORS.success);
  doc.roundedRect(20, y + 12, (pageWidth - 50) * (progress / 100), 5, 1, 1, 'F');
  doc.setDrawColor(...COLORS.gray);
  doc.roundedRect(20, y + 12, pageWidth - 50, 5, 1, 1, 'S');
  
  y += 25;
  
  // Barra de progreso financiero
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(15, y, pageWidth - 30, 20, 2, 2, 'F');
  
  doc.text('Avance Financiero:', 20, y + 8);
  doc.text(`${financialProgress.toFixed(1)}%`, pageWidth - 25, y + 8, { align: 'right' });
  
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(20, y + 12, (pageWidth - 50) * (financialProgress / 100), 5, 1, 1, 'F');
  doc.roundedRect(20, y + 12, pageWidth - 50, 5, 1, 1, 'S');
  
  y += 30;
  
  // Resumen financiero
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('RESUMEN FINANCIERO', 15, y);
  
  autoTable(doc, {
    startY: y + 5,
    head: [['Concepto', 'Presupuestado', 'Ejecutado', 'Diferencia']],
    body: [
      ['Costo Directo', fmtCurrency(totals.directCost), fmtCurrency(executedCost), fmtCurrency(totals.directCost - executedCost)],
      ['Presupuesto Total', fmtCurrency(totals.totalBudget), fmtCurrency(executedCost * 1.3), fmtCurrency(totals.totalBudget - executedCost * 1.3)],
    ],
    theme: 'striped',
    headStyles: { fillColor: COLORS.primary, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 4 },
  });
  
  addFooter(doc, 1, 1);
  doc.save(`Informe_Avance_${project.name.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

// Generar CSV de presupuesto
export const generateBudgetCSV = (project: Project) => {
  const totals = calculateProjectTotals(project);
  
  const headers = ['Código', 'Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Subtotal', 'Categoría'];
  const rows = project.items.map(item => {
    const matSum = item.materials.reduce((acc, m) => acc + (m.price * m.quantity), 0);
    const labSum = item.labor.reduce((acc, l) => acc + (l.price * l.quantity), 0);
    const unitTotal = matSum + labSum;
    return [
      item.code,
      `"${item.description}"`,
      item.unit,
      item.projectQuantity.toFixed(2),
      unitTotal.toFixed(2),
      (unitTotal * item.projectQuantity).toFixed(2),
      item.category
    ];
  });

  // Agregar resumen al final
  rows.push(['', '', '', '', '', '', '']);
  rows.push(['RESUMEN', '', '', '', '', '', '']);
  rows.push(['Costo Directo', '', '', '', '', totals.directCost.toFixed(2), '']);
  rows.push(['Costos Indirectos', '', '', '', '', totals.indirectCost.toFixed(2), '']);
  rows.push(['Gastos Administrativos', '', '', '', '', totals.adminCost.toFixed(2), '']);
  rows.push(['Gastos de Personal', '', '', '', '', totals.personalCost.toFixed(2), '']);
  rows.push(['TOTAL PRESUPUESTO', '', '', '', '', totals.totalBudget.toFixed(2), '']);

  const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `Presupuesto_${project.name.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
