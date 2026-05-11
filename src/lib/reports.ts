/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Sistema de Informes PDF Profesionales - CONSTRUCTORA WM/M&S
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Project, MATERIALS_BY_CATEGORY } from '../constants';

// Colores corporativos
const COLORS = {
  primary:   [15, 23, 42]    as [number, number, number],
  secondary: [245, 158, 11]  as [number, number, number],
  accent:    [59, 130, 246]  as [number, number, number],
  success:   [16, 185, 129]  as [number, number, number],
  warning:   [251, 146, 60]  as [number, number, number],
  danger:    [239, 68, 68]   as [number, number, number],
  light:     [248, 250, 252] as [number, number, number],
  dark:      [30, 41, 59]    as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
  gray:      [100, 116, 139] as [number, number, number],
};

// Helper para formatear moneda
const fmtCurrency = (n: number) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Helpers para evitar spread de tuplas en jsPDF
const setFill = (doc: jsPDF, c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
const setTxt  = (doc: jsPDF, c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
const setDraw = (doc: jsPDF, c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

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

// Función para calcular materiales del proyecto (para informes)
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
        summary[key] = {
          name: mat.materialName,
          unit: mat.unit,
          totalQuantity,
          category: mat.category
        };
      }
    });
  });
  
  // Ordenar por categoría y nombre
  const categories = ['concreto', 'acero', 'mamposteria', 'acabados', 'instalaciones', 'varios'];
  return Object.values(summary).sort((a, b) => {
    const catA = categories.indexOf(a.category);
    const catB = categories.indexOf(b.category);
    if (catA !== catB) return catA - catB;
    return a.name.localeCompare(b.name);
  });
};

// Agregar encabezado corporativo
const addHeader = (doc: jsPDF, title: string, subtitle?: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Fondo del header
  setFill(doc, COLORS.primary);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Línea decorativa secundaria
  setFill(doc, COLORS.primary);
  doc.rect(0, 45, pageWidth, 3, 'F');
  
  // Logo / Nombre empresa
  setTxt(doc, COLORS.white);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('CONSTRUCTORA WM/M&S', 15, 22);
  
  // Slogan
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  setTxt(doc, COLORS.white);
  doc.text('CONSTRUYENDO EL FUTURO', 15, 32);
  
  // Título del documento
  setTxt(doc, COLORS.white);
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
  setDraw(doc, COLORS.gray);
  doc.setLineWidth(0.5);
  doc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20);
  
  // Texto del footer
  doc.setFontSize(7);
  setTxt(doc, COLORS.white);
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
  
  setFill(doc, COLORS.primary);
  doc.roundedRect(15, startY, pageWidth - 30, 35, 3, 3, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  setTxt(doc, COLORS.white);
  doc.text('DATOS DEL PROYECTO', 20, startY + 10);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  setTxt(doc, COLORS.white);
  
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
  setTxt(doc, COLORS.white);
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
  setTxt(doc, COLORS.white);
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
      setFill(doc, COLORS.primary);
      doc.roundedRect(15, currentY, pageWidth - 30, 10, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      setTxt(doc, COLORS.white);
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

  // ─────────────────────────────────────────────────────────────────────────
  // Página de RESUMEN DE MATERIALES
  // ─────────────────────────────────────────────────────────────────────────
  const projectMaterials = calculateProjectMaterials(project);
  
  if (projectMaterials.length > 0) {
    doc.addPage();
    addHeader(doc, 'RESUMEN DE MATERIALES', project.name);
    
    // Agrupar por categoría
    const categories = [
      { key: 'concreto', label: 'CONCRETO', color: COLORS.gray },
      { key: 'acero', label: 'ACERO Y FERRETERÍA', color: COLORS.danger },
      { key: 'mamposteria', label: 'MAMPOSTERÍA', color: COLORS.secondary },
      { key: 'acabados', label: 'ACABADOS', color: COLORS.success },
      { key: 'instalaciones', label: 'INSTALACIONES', color: COLORS.accent },
      { key: 'varios', label: 'VARIOS', color: COLORS.gray },
    ];
    
    let matY = 55;
    
    categories.forEach(cat => {
      const materialsInCat = projectMaterials.filter(m => m.category === cat.key);
      if (materialsInCat.length === 0) return;
      
      if (matY > 250) {
        doc.addPage();
        addHeader(doc, 'RESUMEN DE MATERIALES', project.name);
        matY = 55;
      }
      
      // Título de categoría
      setFill(doc, cat.color);
      doc.roundedRect(15, matY, pageWidth - 30, 8, 1, 1, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      setTxt(doc, COLORS.white);
      doc.text(cat.label, 20, matY + 6);
      
      matY += 12;
      
      // Tabla de materiales
      const matRows = materialsInCat.map(m => [
        m.name,
        m.unit,
        m.totalQuantity.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 3 })
      ]);
      
      autoTable(doc, {
        startY: matY,
        head: [['Material', 'Unidad', 'Cantidad Total']],
        body: matRows,
        theme: 'striped',
        headStyles: { fillColor: cat.color, fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 7, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
        },
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
  doc.setFont('helvetica', 'normal');
  setTxt(doc, COLORS.white);
  doc.text('El presente presupuesto ha sido elaborado de acuerdo a los estándares de la industria de construcción', pageWidth / 2, signY, { align: 'center' });
  doc.text('y está sujeto a las condiciones especificadas en el contrato de obra.', pageWidth / 2, signY + 6, { align: 'center' });
  
  signY += 40;
  
  // Cajas de firma
  const signBoxWidth = 70;
  const signBoxHeight = 45;
  
  // Firma Contratista
  setDraw(doc, COLORS.gray);
  doc.setLineWidth(0.3);
  doc.roundedRect(25, signY, signBoxWidth, signBoxHeight, 3, 3, 'S');
  doc.setFontSize(7);
  setTxt(doc, COLORS.white);
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
  setTxt(doc, COLORS.white);
  doc.text(`Presupuesto válido por 30 días a partir del ${fmtDate()}`, pageWidth / 2, signY, { align: 'center' });
  
  // Agregar footers a todas las páginas
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  doc.save(`Presupuesto_${project.name.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ── Plantilla EJECUTIVA (1 página, resumen compacto) ─────────────────────────
export const generateBudgetPDFEjecutivo = (project: Project) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const totals = calculateProjectTotals(project);

  addHeader(doc, 'COTIZACIÓN EJECUTIVA', `Ref: ${project.id?.slice(0, 8) || 'NUEVO'}`);

  let y = addProjectInfo(doc, project, 60);
  y = addExecutiveSummary(doc, project, totals, y + 5);

  // Tabla resumen de renglones (sin desglose)
  autoTable(doc, {
    startY: y + 5,
    head: [['#', 'Descripción', 'Unid.', 'Cant.', 'P.Unit Q', 'Subtotal Q']],
    body: project.items.map((item, i) => {
      const u = item.materials.reduce((a, m) => a + m.price * m.quantity, 0) +
                item.labor.reduce((a, l) => a + l.price * l.quantity, 0);
      return [i + 1, item.description.slice(0, 40), item.unit,
        item.projectQuantity.toFixed(2), fmtCurrency(u), fmtCurrency(u * item.projectQuantity)];
    }),
    foot: [['', '', '', '', 'TOTAL:', fmtCurrency(totals.totalBudget)]],
    theme: 'striped',
    headStyles: { fillColor: COLORS.primary, fontSize: 7, fontStyle: 'bold' },
    footStyles: { fillColor: COLORS.secondary, textColor: COLORS.primary, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 2.5 },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 65 }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // RESUMEN DE MATERIALES (versión ejecutiva compacta)
  // ─────────────────────────────────────────────────────────────────────────
  const projectMaterials = calculateProjectMaterials(project);
  
  if (projectMaterials.length > 0) {
    let matY = (doc as any).lastAutoTable.finalY + 15;
    
    // Título
    setFill(doc, COLORS.primary);
    doc.roundedRect(15, matY, pageWidth - 30, 10, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    setTxt(doc, COLORS.white);
    doc.text('RESUMEN DE MATERIALES', 20, matY + 7);
    
    matY += 15;
    
    // Tabla compacta de materiales
    const matRows = projectMaterials.slice(0, 15).map(m => [
      m.name.length > 30 ? m.name.substring(0, 30) + '...' : m.name,
      m.unit,
      m.totalQuantity.toLocaleString('es-GT', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
    ]);
    
    autoTable(doc, {
      startY: matY,
      head: [['Material', 'Und', 'Cantidad']],
      body: matRows,
      theme: 'striped',
      headStyles: { fillColor: COLORS.secondary, fontSize: 7, fontStyle: 'bold' },
      styles: { fontSize: 6, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 30, halign: 'right' }
      },
      margin: { left: 15, right: 15 }
    });
  }

  // Bloque de validez y firma
  const finalY = Math.min((doc as any).lastAutoTable.finalY + 10, 250);
  setFill(doc, COLORS.light);
  doc.roundedRect(15, finalY, pageWidth - 30, 22, 2, 2, 'F');
  setTxt(doc, COLORS.gray);
  doc.setFontSize(7);
  doc.text(`Presupuesto válido por 30 días · Elaborado: ${fmtDate()} · CONSTRUCTORA WM/M&S`, pageWidth / 2, finalY + 8, { align: 'center' });
  doc.text('Precios sujetos a variación según condiciones de mercado y disponibilidad de materiales.', pageWidth / 2, finalY + 14, { align: 'center' });

  addFooter(doc, 1, 1);
  doc.save(`Cotizacion_Ejecutiva_${project.name.replace(/\s/g, '_')}.pdf`);
};

// ── Plantilla EJECUTIVA CLIENTE (solo resumen total + tiempo) ─────────────────
export const generateBudgetPDFCliente = (project: Project) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const totals = calculateProjectTotals(project);

  addHeader(doc, 'PRESUPUESTO PARA CLIENTE', `Ref: ${project.id?.slice(0, 8) || 'NUEVO'}`);

  let y = addProjectInfo(doc, project, 60);
  
  // Solo resumen ejecutivo (sin tabla de renglones)
  y = addExecutiveSummary(doc, project, totals, y + 5);
  
  // Información adicional para el cliente
  y += 15;
  setFill(doc, COLORS.primary);
  doc.roundedRect(15, y, pageWidth - 30, 12, 2, 2, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  setTxt(doc, COLORS.white);
  doc.text('RESUMEN FINAL', 20, y + 7);
  
  y += 20;
  
  // Cajas de resumen final
  const boxWidth = (pageWidth - 45) / 2;
  
  // Caja 1: Total Presupuesto
  setFill(doc, COLORS.success);
  doc.roundedRect(15, y, boxWidth - 5, 25, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  setTxt(doc, COLORS.white);
  doc.text('PRESUPUESTO TOTAL', 20, y + 8);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtCurrency(totals.totalBudget), 20, y + 18);
  
  // Caja 2: Duración Estimada
  setFill(doc, COLORS.accent);
  doc.roundedRect(15 + boxWidth, y, boxWidth - 5, 25, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  setTxt(doc, COLORS.white);
  doc.text('DURACIÓN ESTIMADA', 20 + boxWidth, y + 8);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`${Math.ceil(totals.estimatedDays)} DÍAS`, 20 + boxWidth, y + 18);
  
  y += 40;
  
  // Condiciones del presupuesto
  setFill(doc, COLORS.light);
  doc.roundedRect(15, y, pageWidth - 30, 35, 2, 2, 'F');
  setTxt(doc, COLORS.gray);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('CONDICIONES DEL PRESUPUESTO:', 20, y + 8);
  
  doc.setFont('helvetica', 'normal');
  const conditions = [
    '• El presente presupuesto incluye materiales, mano de obra, impuestos y costos indirectos.',
    '• La validez de este presupuesto es de 30 días a partir de la fecha de emisión.',
    '• Los plazos de entrega están sujetos a disponibilidad de materiales y condiciones del sitio.',
    '• Cualquier modificación en el alcance del proyecto requerirá una nueva cotización.',
    '• El pago se realizará según el avance de obra con facturas correspondientes.',
  ];
  
  conditions.forEach((cond, i) => {
    doc.setFontSize(6);
    doc.text(cond, 20, y + 16 + (i * 5));
  });
  
  y += 55;
  
  // Bloque de firma
  const signBoxWidth = 80;
  const signBoxHeight = 40;
  
  // Firma Contratista
  setDraw(doc, COLORS.gray);
  doc.setLineWidth(0.3);
  doc.roundedRect(25, y, signBoxWidth, signBoxHeight, 3, 3, 'S');
  doc.setFontSize(7);
  setTxt(doc, COLORS.white);
  doc.text('CONSTRUCTORA WM/M&S', 25 + signBoxWidth / 2, y + 10, { align: 'center' });
  doc.line(35, y + 30, 25 + signBoxWidth - 10, y + 30);
  doc.text('Firma y Sello', 25 + signBoxWidth / 2, y + 36, { align: 'center' });
  
  // Firma Cliente
  doc.roundedRect(pageWidth - 25 - signBoxWidth, y, signBoxWidth, signBoxHeight, 3, 3, 'S');
  doc.text('CLIENTE', pageWidth - 25 - signBoxWidth / 2, y + 10, { align: 'center' });
  doc.text(project.clientName || 'Sin especificar', pageWidth - 25 - signBoxWidth / 2, y + 18, { align: 'center' });
  doc.line(pageWidth - 25 - signBoxWidth + 10, y + 30, pageWidth - 35, y + 30);
  doc.text('Firma de Aceptación', pageWidth - 25 - signBoxWidth / 2, y + 36, { align: 'center' });
  
  // Agregar footers
  addFooter(doc, 1, 1);
  
  doc.save(`Presupuesto_Cliente_${project.name.replace(/\s/g, '_')}.pdf`);
};

// ── Plantilla APU COMPLETO (análisis de precios unitarios por renglón) ────────
export const generateBudgetPDFAPU = (project: Project) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const totals = calculateProjectTotals(project);
  let pageNum = 1;

  // Portada
  addHeader(doc, 'ANÁLISIS DE PRECIOS UNITARIOS', project.name);
  let y = addProjectInfo(doc, project, 60);
  y = addExecutiveSummary(doc, project, totals, y + 5);

  // Índice de renglones
  setFill(doc, COLORS.light);
  doc.roundedRect(15, y + 5, pageWidth - 30, 8, 2, 2, 'F');
  setTxt(doc, COLORS.primary);
  doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('ÍNDICE DE RENGLONES', 20, y + 11);
  y += 18;

  project.items.forEach((item, i) => {
    const u = item.materials.reduce((a, m) => a + m.price * m.quantity, 0) +
              item.labor.reduce((a, l) => a + l.price * l.quantity, 0);
    setTxt(doc, COLORS.gray);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(`${i + 1}. ${item.description.slice(0, 55)}`, 20, y);
    doc.text(fmtCurrency(u * item.projectQuantity), pageWidth - 20, y, { align: 'right' });
    y += 6;
    if (y > 260) { addFooter(doc, pageNum, 99); doc.addPage(); pageNum++; addHeader(doc, 'APU — ÍNDICE', project.name); y = 60; }
  });

  // Una página por renglón (APU detallado con materiales unitarios)
  project.items.forEach((item, idx) => {
    addFooter(doc, pageNum, 99); doc.addPage(); pageNum++;
    addHeader(doc, `APU ${idx + 1}/${project.items.length}`, project.name);

    let cy = 58;
    // Encabezado del renglón
    setFill(doc, COLORS.primary);
    doc.roundedRect(15, cy, pageWidth - 30, 14, 2, 2, 'F');
    setTxt(doc, COLORS.secondary);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(`${item.code} — ${item.description}`, 20, cy + 6);
    setTxt(doc, COLORS.white);
    doc.setFontSize(7);
    doc.text(`Unidad: ${item.unit} | Cantidad: ${item.projectQuantity} | Categoría: ${item.category}`, 20, cy + 12);
    cy += 18;

    // Materiales
    const matRows = item.materials.map(m => [
      m.name, m.unit,
      m.quantity.toFixed(3),
      fmtCurrency(m.price),
      fmtCurrency(m.price * m.quantity)
    ]);
    autoTable(doc, {
      startY: cy,
      head: [['MATERIALES', 'Unid.', 'Cant./unid.', 'P.Unit Q', 'Subtotal Q']],
      body: matRows,
      theme: 'grid',
      headStyles: { fillColor: COLORS.accent, fontSize: 7, fontStyle: 'bold' },
      styles: { fontSize: 7, cellPadding: 2.5 },
      columnStyles: { 0: { cellWidth: 70 }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: 15, right: 15 }
    });
    cy = (doc as any).lastAutoTable.finalY + 4;

    // Mano de obra
    const labRows = item.labor.map(l => [
      l.role, l.unit,
      l.quantity.toFixed(3),
      fmtCurrency(l.price),
      fmtCurrency(l.price * l.quantity)
    ]);
    autoTable(doc, {
      startY: cy,
      head: [['MANO DE OBRA', 'Unid.', 'Cant./unid.', 'P.Unit Q', 'Subtotal Q']],
      body: labRows,
      theme: 'grid',
      headStyles: { fillColor: COLORS.dark, fontSize: 7, fontStyle: 'bold' },
      styles: { fontSize: 7, cellPadding: 2.5 },
      columnStyles: { 0: { cellWidth: 70 }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: 15, right: 15 }
    });
    cy = (doc as any).lastAutoTable.finalY + 4;

    // ─────────────────────────────────────────────────────────────────────
    // MATERIALES UNITARIOS CALCULADOS (desglose por renglón)
    // ─────────────────────────────────────────────────────────────────────
    const materialsConfig = MATERIALS_BY_CATEGORY[item.category] || [];
    if (materialsConfig.length > 0) {
      const calculatedMats = materialsConfig.map(m => {
        const qty = m.quantity * item.projectQuantity;
        // Buscar precio aproximado
        const unitPrice = item.materials.reduce((sum, mat) => {
          if (mat.name.toLowerCase().includes(m.materialName.toLowerCase())) {
            return mat.price;
          }
          return sum;
        }, 0);
        return [
          m.materialName,
          m.unit,
          m.quantity.toFixed(3),
          qty.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 3 }),
          fmtCurrency(unitPrice),
          fmtCurrency(qty * unitPrice)
        ];
      });
      
      autoTable(doc, {
        startY: cy,
        head: [['MATERIALES UNITARIOS', 'Unid.', 'x Und', 'Cant. Total', 'P.Unit Q', 'Subtotal Q']],
        body: calculatedMats,
        theme: 'grid',
        headStyles: { fillColor: COLORS.success, fontSize: 7, fontStyle: 'bold' },
        styles: { fontSize: 6, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 65 },
          1: { cellWidth: 18, halign: 'center' },
          2: { cellWidth: 22, halign: 'right' },
          3: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
          4: { cellWidth: 25, halign: 'right' },
          5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: 15, right: 15 }
      });
      cy = (doc as any).lastAutoTable.finalY + 4;
    }

    // Resumen del renglón
    const matTotal = item.materials.reduce((a, m) => a + m.price * m.quantity, 0);
    const labTotal = item.labor.reduce((a, l) => a + l.price * l.quantity, 0);
    const unitCost = matTotal + labTotal;
    const workers  = Math.max(1, item.labor.reduce((s, l) => s + l.quantity, 0));
    const realDays = Math.ceil((item.projectQuantity * (item.durationDays || 1)) / workers);

    setFill(doc, COLORS.secondary);
    doc.roundedRect(15, cy, pageWidth - 30, 18, 2, 2, 'F');
    setTxt(doc, COLORS.primary);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(`Costo unitario: ${fmtCurrency(unitCost)}/${item.unit}`, 20, cy + 7);
    doc.text(`Subtotal renglón: ${fmtCurrency(unitCost * item.projectQuantity)}`, 20, cy + 14);
    doc.text(`Duración real: ${realDays} días (${workers} obreros)`, pageWidth / 2, cy + 7);
    doc.text(`Rendimiento: ${item.durationDays} días/${item.unit}`, pageWidth / 2, cy + 14);
  });

  // Página de totales finales
  addFooter(doc, pageNum, 99); doc.addPage(); pageNum++;
  addHeader(doc, 'RESUMEN FINAL', project.name);
  addExecutiveSummary(doc, project, totals, 60);
  addFooter(doc, pageNum, pageNum);

  // Corregir total de páginas
  const total = pageNum;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    addFooter(doc, i, total);
  }

  doc.save(`APU_Completo_${project.name.replace(/\s/g, '_')}.pdf`);
};


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
  
  setFill(doc, COLORS.primary);
  doc.roundedRect(20, y + 12, (pageWidth - 50) * (progress / 100), 5, 1, 1, 'F');
  setDraw(doc, COLORS.gray);
  doc.roundedRect(20, y + 12, pageWidth - 50, 5, 1, 1, 'S');
  
  y += 25;
  
  // Barra de progreso financiero
  setFill(doc, COLORS.primary);
  doc.roundedRect(15, y, pageWidth - 30, 20, 2, 2, 'F');
  
  doc.text('Avance Financiero:', 20, y + 8);
  doc.text(`${financialProgress.toFixed(1)}%`, pageWidth - 25, y + 8, { align: 'right' });
  
  setFill(doc, COLORS.primary);
  doc.roundedRect(20, y + 12, (pageWidth - 50) * (financialProgress / 100), 5, 1, 1, 'F');
  doc.roundedRect(20, y + 12, pageWidth - 50, 5, 1, 1, 'S');
  
  y += 30;
  
  // Resumen financiero
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  setTxt(doc, COLORS.white);
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

  // ─────────────────────────────────────────────────────────────────────────
  // AGREGAR RESUMEN DE MATERIALES AL CSV
  // ─────────────────────────────────────────────────────────────────────────
  const projectMaterials = calculateProjectMaterials(project);
  
  if (projectMaterials.length > 0) {
    rows.push(['', '', '', '', '', '', '']);
    rows.push(['RESUMEN DE MATERIALES', '', '', '', '', '', '']);
    rows.push(['Material', 'Unidad', 'Cantidad Total', 'Categoría', '', '', '']);
    
    projectMaterials.forEach(mat => {
      rows.push([
        mat.name,
        mat.unit,
        mat.totalQuantity.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 3 }),
        mat.category,
        '', '', ''
      ]);
    });
  }

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


