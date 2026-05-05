import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Papa from 'papaparse';
import { Project } from '../constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportStyle = 'Modern' | 'Minimal' | 'Professional';

export interface ExportData {
  title: string;
  projectName: string;
  clientName: string;
  headers: string[];
  rows: any[][];
}

export interface PdfTemplate { id: string; label: string; }
export interface CsvTemplate { id: string; label: string; }

export const PDF_TEMPLATES: PdfTemplate[] = [
  { id: 'modern',       label: 'Moderno (Color)' },
  { id: 'minimal',      label: 'Minimalista' },
  { id: 'professional', label: 'Profesional' },
  { id: 'detallado',    label: 'Detallado Completo' },
  { id: 'ejecutivo',    label: 'Ejecutivo Resumen' },
];

export const CSV_TEMPLATES: CsvTemplate[] = [
  { id: 'completo',    label: 'Completo (todos los campos)' },
  { id: 'renglones',   label: 'Resumen de Renglones' },
  { id: 'materiales',  label: 'Desglose de Materiales' },
  { id: 'costos',      label: 'Costos y Presupuesto' },
  { id: 'ejecutivo',   label: 'Ejecutivo (1 fila)' },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPANY = 'Multiservicios de Guatemala';
const FOOTER_SLOGAN = 'Calidad y Confianza en cada obra.';
const FOOTER_ADDRESS = 'Municipio de Quesada';
const FOOTER_PHONES = '55606172 - 40601526';
const FOOTER_EMAILS = 'salazaroliveros@gmail.com, multiserviciosdeguatemal@gmail.com';

function fmtQ(n: number) {
  return 'Q ' + n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcItemMaterials(item: any): number {
  return (item.materials || []).reduce((a: number, m: any) => a + (m.price * m.quantity * (item.projectQuantity || 1)), 0);
}
function calcItemLabor(item: any): number {
  return (item.labor || []).reduce((a: number, l: any) => a + (l.price * l.quantity * (item.projectQuantity || 1)), 0);
}
function calcItemTotal(item: any): number {
  return calcItemMaterials(item) + calcItemLabor(item);
}
function calcProjectDirectCost(project: Project): number {
  return (project.items || []).reduce((a, item) => a + calcItemTotal(item), 0);
}
function calcProjectTotalCost(project: Project): number {
  const direct = project.directCosts || calcProjectDirectCost(project);
  const factor = 1 + ((project.indirectCosts || 0) + (project.administrativeCosts || 0) + (project.personalCosts || 0)) / 100;
  return direct * factor;
}

// ─── PDF generation ───────────────────────────────────────────────────────────

function addPdfHeader(doc: jsPDF, project: Project, title: string, accentColor: number[]) {
  const [r, g, b] = accentColor;
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY, 14, 11);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 14, 18);
  doc.setFontSize(8);
  doc.text(`Proyecto: ${project.name}  |  Cliente: ${project.clientName}  |  Fecha: ${new Date().toLocaleDateString('es-GT')}`, 14, 24);
  doc.setTextColor(0, 0, 0);
}

function addPdfFooter(doc: jsPDF) {
  const h = doc.internal.pageSize.height;
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(FOOTER_SLOGAN, 105, h - 14, { align: 'center' });
  doc.text(`📍 ${FOOTER_ADDRESS}  |  📱 ${FOOTER_PHONES}  |  ✉️ ${FOOTER_EMAILS}`, 105, h - 9, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

function addSectionTitle(doc: jsPDF, title: string, y: number, color: number[]) {
  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(14, y - 4, 182, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), 16, y + 0.5);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  return y + 8;
}

function getTemplateColors(templateId: string): { accent: number[]; header: number[]; altRow: number[] } {
  switch (templateId) {
    case 'minimal':      return { accent: [80, 80, 80],    header: [200, 200, 200], altRow: [248, 248, 248] };
    case 'professional': return { accent: [26, 26, 26],    header: [26, 26, 26],    altRow: [245, 245, 245] };
    case 'detallado':    return { accent: [30, 64, 175],   header: [30, 64, 175],   altRow: [239, 246, 255] };
    case 'ejecutivo':    return { accent: [5, 150, 105],   header: [5, 150, 105],   altRow: [236, 253, 245] };
    default:             return { accent: [241, 90, 36],   header: [241, 90, 36],   altRow: [255, 247, 243] }; // modern
  }
}

export function generateProjectPDF(project: Project, templateId: string = 'modern') {
  const doc = new jsPDF();
  const colors = getTemplateColors(templateId);
  const items = project.items || [];

  const directCost = project.directCosts || calcProjectDirectCost(project);
  const indirectAmt = directCost * (project.indirectCosts || 0) / 100;
  const adminAmt    = directCost * (project.administrativeCosts || 0) / 100;
  const personalAmt = directCost * (project.personalCosts || 0) / 100;
  const totalCost   = directCost + indirectAmt + adminAmt + personalAmt;
  const utilidad    = (project.budget || 0) - totalCost;
  const margen      = project.budget > 0 ? (utilidad / project.budget) * 100 : 0;

  const templateLabel = PDF_TEMPLATES.find(t => t.id === templateId)?.label || templateId;
  addPdfHeader(doc, project, `Informe de Proyecto — Plantilla: ${templateLabel}`, colors.accent);

  let y = 34;

  // ── Resumen General ──────────────────────────────────────────────────────────
  y = addSectionTitle(doc, 'Resumen General', y, colors.header);
  (doc as any).autoTable({
    startY: y,
    head: [['Campo', 'Valor']],
    body: [
      ['Estado',        project.status],
      ['Tipología',     project.typology],
      ['Ubicación',     project.location || 'N/A'],
      ['Fecha Inicio',  project.startDate || 'N/A'],
      ['Fecha Fin',     project.endDate || 'N/A'],
      ['Progreso',      `${project.progress || 0}%`],
      ['Presupuesto',   fmtQ(project.budget || 0)],
    ],
    headStyles: { fillColor: colors.header, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: colors.altRow },
    margin: { left: 14, right: 14 },
    theme: 'grid',
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Resumen de Renglones ─────────────────────────────────────────────────────
  if (items.length > 0) {
    y = addSectionTitle(doc, 'Resumen de Renglones', y, colors.header);
    (doc as any).autoTable({
      startY: y,
      head: [['Cód', 'Descripción', 'Unidad', 'Cant.', 'Materiales (Q)', 'Mano Obra (Q)', 'Total (Q)']],
      body: items.map(item => [
        item.code || '',
        item.description || '',
        item.unit || '',
        item.projectQuantity || 0,
        fmtQ(calcItemMaterials(item)),
        fmtQ(calcItemLabor(item)),
        fmtQ(calcItemTotal(item)),
      ]),
      foot: [['', '', '', 'TOTAL', fmtQ(items.reduce((a, i) => a + calcItemMaterials(i), 0)), fmtQ(items.reduce((a, i) => a + calcItemLabor(i), 0)), fmtQ(items.reduce((a, i) => a + calcItemTotal(i), 0))]],
      headStyles: { fillColor: colors.header, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
      footStyles: { fillColor: colors.accent, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: colors.altRow },
      margin: { left: 14, right: 14 },
      theme: 'grid',
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Desglose Unitario de Materiales (skip for ejecutivo template) ─────────────
  if (templateId !== 'ejecutivo' && items.length > 0) {
    for (const item of items) {
      if ((item.materials || []).length === 0 && (item.labor || []).length === 0) continue;

      // Check if we need a new page
      if (y > 240) { doc.addPage(); y = 14; }

      y = addSectionTitle(doc, `Desglose: ${item.description || item.code}`, y, colors.header);

      if ((item.materials || []).length > 0) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('Materiales:', 14, y + 3);
        doc.setFont('helvetica', 'normal');
        y += 5;
        (doc as any).autoTable({
          startY: y,
          head: [['Material', 'Unidad', 'Cant. Unit.', 'Cant. Total', 'P. Unit. (Q)', 'Subtotal (Q)']],
          body: (item.materials || []).map((m: any) => [
            m.name,
            m.unit,
            m.quantity,
            (m.quantity * (item.projectQuantity || 1)).toFixed(2),
            fmtQ(m.price),
            fmtQ(m.price * m.quantity * (item.projectQuantity || 1)),
          ]),
          headStyles: { fillColor: [100, 100, 100], textColor: [255, 255, 255], fontSize: 7 },
          bodyStyles: { fontSize: 7 },
          alternateRowStyles: { fillColor: [250, 250, 250] },
          margin: { left: 14, right: 14 },
          theme: 'grid',
          columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } },
        });
        y = (doc as any).lastAutoTable.finalY + 4;
      }

      if ((item.labor || []).length > 0) {
        if (y > 240) { doc.addPage(); y = 14; }
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('Mano de Obra:', 14, y + 3);
        doc.setFont('helvetica', 'normal');
        y += 5;
        (doc as any).autoTable({
          startY: y,
          head: [['Rol', 'Unidad', 'Cant. Unit.', 'Cant. Total', 'P. Unit. (Q)', 'Subtotal (Q)']],
          body: (item.labor || []).map((l: any) => [
            l.role,
            l.unit,
            l.quantity,
            (l.quantity * (item.projectQuantity || 1)).toFixed(2),
            fmtQ(l.price),
            fmtQ(l.price * l.quantity * (item.projectQuantity || 1)),
          ]),
          headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontSize: 7 },
          bodyStyles: { fontSize: 7 },
          alternateRowStyles: { fillColor: [250, 250, 250] },
          margin: { left: 14, right: 14 },
          theme: 'grid',
          columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }
    }
  }

  // ── Totales de la Construcción ───────────────────────────────────────────────
  if (y > 230) { doc.addPage(); y = 14; }
  y = addSectionTitle(doc, 'Totales de la Construcción', y, colors.accent);
  (doc as any).autoTable({
    startY: y,
    head: [['Concepto', 'Monto (Q)']],
    body: [
      ['Costo Directo (Materiales + Mano de Obra)', fmtQ(directCost)],
      [`Costos Indirectos (${project.indirectCosts || 0}%)`, fmtQ(indirectAmt)],
      [`Costos Administrativos (${project.administrativeCosts || 0}%)`, fmtQ(adminAmt)],
      [`Costos de Personal (${project.personalCosts || 0}%)`, fmtQ(personalAmt)],
      ['COSTO TOTAL', fmtQ(totalCost)],
      ['PRESUPUESTO OFERTADO', fmtQ(project.budget || 0)],
      [`UTILIDAD ESTIMADA (${margen.toFixed(1)}%)`, fmtQ(utilidad)],
    ],
    headStyles: { fillColor: colors.accent, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: colors.altRow },
    margin: { left: 14, right: 14 },
    theme: 'grid',
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    didParseCell: (data: any) => {
      if (data.row.index >= 4 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        if (data.row.index === 4) data.cell.styles.fillColor = [220, 220, 220];
        if (data.row.index === 5) data.cell.styles.fillColor = colors.altRow;
        if (data.row.index === 6) {
          data.cell.styles.fillColor = utilidad >= 0 ? [209, 250, 229] : [254, 226, 226];
          data.cell.styles.textColor = utilidad >= 0 ? [6, 95, 70] : [153, 27, 27];
        }
      }
    },
  });

  addPdfFooter(doc);
  doc.save(`${project.name}_informe_${templateId}.pdf`);
}

// ─── CSV generation ───────────────────────────────────────────────────────────

function downloadCsv(rows: any[][], filename: string) {
  const BOM = '\uFEFF';
  const csv = Papa.unparse(rows, { delimiter: ';' });
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

export function generateProjectCSV(project: Project, templateId: string = 'completo') {
  const items = project.items || [];
  const directCost = project.directCosts || items.reduce((a, i) => a + calcItemTotal(i), 0);
  const totalCost = calcProjectTotalCost(project);
  const utilidad = (project.budget || 0) - totalCost;

  let rows: any[][] = [];

  switch (templateId) {
    case 'renglones':
      rows = [
        [COMPANY, '', '', '', '', '', ''],
        [`Resumen de Renglones — ${project.name}`, '', '', '', '', '', ''],
        [`Cliente: ${project.clientName}`, '', '', '', '', '', ''],
        [],
        ['Código', 'Descripción', 'Unidad', 'Cantidad', 'Materiales (Q)', 'Mano de Obra (Q)', 'Total (Q)'],
        ...items.map(item => [
          item.code || '',
          item.description || '',
          item.unit || '',
          item.projectQuantity || 0,
          calcItemMaterials(item).toFixed(2),
          calcItemLabor(item).toFixed(2),
          calcItemTotal(item).toFixed(2),
        ]),
        [],
        ['', '', '', 'TOTAL',
          items.reduce((a, i) => a + calcItemMaterials(i), 0).toFixed(2),
          items.reduce((a, i) => a + calcItemLabor(i), 0).toFixed(2),
          items.reduce((a, i) => a + calcItemTotal(i), 0).toFixed(2),
        ],
      ];
      break;

    case 'materiales':
      rows = [
        [COMPANY],
        [`Desglose de Materiales — ${project.name}`],
        [`Cliente: ${project.clientName}`],
        [],
        ['Renglón', 'Material', 'Unidad', 'Cant. Unit.', 'Cant. Total', 'Precio Unit. (Q)', 'Subtotal (Q)'],
        ...items.flatMap(item =>
          (item.materials || []).map((m: any) => [
            item.description || item.code,
            m.name,
            m.unit,
            m.quantity,
            (m.quantity * (item.projectQuantity || 1)).toFixed(2),
            m.price.toFixed(2),
            (m.price * m.quantity * (item.projectQuantity || 1)).toFixed(2),
          ])
        ),
      ];
      break;

    case 'costos':
      rows = [
        [COMPANY],
        [`Costos y Presupuesto — ${project.name}`],
        [`Cliente: ${project.clientName}`],
        [],
        ['Concepto', 'Monto (Q)'],
        ['Costo Directo', directCost.toFixed(2)],
        [`Indirecto (${project.indirectCosts || 0}%)`, (directCost * (project.indirectCosts || 0) / 100).toFixed(2)],
        [`Administrativo (${project.administrativeCosts || 0}%)`, (directCost * (project.administrativeCosts || 0) / 100).toFixed(2)],
        [`Personal (${project.personalCosts || 0}%)`, (directCost * (project.personalCosts || 0) / 100).toFixed(2)],
        ['COSTO TOTAL', totalCost.toFixed(2)],
        ['PRESUPUESTO', (project.budget || 0).toFixed(2)],
        ['UTILIDAD', utilidad.toFixed(2)],
        ['MARGEN %', project.budget > 0 ? ((utilidad / project.budget) * 100).toFixed(1) + '%' : '0%'],
      ];
      break;

    case 'ejecutivo':
      rows = [
        ['Proyecto', 'Cliente', 'Estado', 'Tipología', 'Ubicación', 'Inicio', 'Fin', 'Progreso', 'Presupuesto (Q)', 'Costo Total (Q)', 'Utilidad (Q)', 'Margen %'],
        [
          project.name,
          project.clientName,
          project.status,
          project.typology,
          project.location || 'N/A',
          project.startDate || 'N/A',
          project.endDate || 'N/A',
          `${project.progress || 0}%`,
          (project.budget || 0).toFixed(2),
          totalCost.toFixed(2),
          utilidad.toFixed(2),
          project.budget > 0 ? ((utilidad / project.budget) * 100).toFixed(1) + '%' : '0%',
        ],
      ];
      break;

    default: // completo
      rows = [
        [COMPANY],
        [`Informe Completo — ${project.name}`],
        [`Cliente: ${project.clientName}  |  Estado: ${project.status}  |  Fecha: ${new Date().toLocaleDateString('es-GT')}`],
        [],
        ['=== INFORMACIÓN GENERAL ==='],
        ['Campo', 'Valor'],
        ['Nombre', project.name],
        ['Cliente', project.clientName],
        ['Estado', project.status],
        ['Tipología', project.typology],
        ['Ubicación', project.location || 'N/A'],
        ['Fecha Inicio', project.startDate || 'N/A'],
        ['Fecha Fin', project.endDate || 'N/A'],
        ['Progreso', `${project.progress || 0}%`],
        [],
        ['=== RESUMEN DE RENGLONES ==='],
        ['Código', 'Descripción', 'Unidad', 'Cantidad', 'Materiales (Q)', 'Mano de Obra (Q)', 'Total (Q)'],
        ...items.map(item => [
          item.code || '',
          item.description || '',
          item.unit || '',
          item.projectQuantity || 0,
          calcItemMaterials(item).toFixed(2),
          calcItemLabor(item).toFixed(2),
          calcItemTotal(item).toFixed(2),
        ]),
        [],
        ['=== DESGLOSE DE MATERIALES ==='],
        ['Renglón', 'Material', 'Unidad', 'Cant. Unit.', 'Cant. Total', 'Precio Unit. (Q)', 'Subtotal (Q)'],
        ...items.flatMap(item =>
          (item.materials || []).map((m: any) => [
            item.description || item.code,
            m.name,
            m.unit,
            m.quantity,
            (m.quantity * (item.projectQuantity || 1)).toFixed(2),
            m.price.toFixed(2),
            (m.price * m.quantity * (item.projectQuantity || 1)).toFixed(2),
          ])
        ),
        [],
        ['=== TOTALES DE LA CONSTRUCCIÓN ==='],
        ['Concepto', 'Monto (Q)'],
        ['Costo Directo', directCost.toFixed(2)],
        [`Indirecto (${project.indirectCosts || 0}%)`, (directCost * (project.indirectCosts || 0) / 100).toFixed(2)],
        [`Administrativo (${project.administrativeCosts || 0}%)`, (directCost * (project.administrativeCosts || 0) / 100).toFixed(2)],
        [`Personal (${project.personalCosts || 0}%)`, (directCost * (project.personalCosts || 0) / 100).toFixed(2)],
        ['COSTO TOTAL', totalCost.toFixed(2)],
        ['PRESUPUESTO', (project.budget || 0).toFixed(2)],
        ['UTILIDAD', utilidad.toFixed(2)],
        ['MARGEN %', project.budget > 0 ? ((utilidad / project.budget) * 100).toFixed(1) + '%' : '0%'],
        [],
        [FOOTER_SLOGAN],
        [FOOTER_ADDRESS],
      ];
      break;
  }

  const templateLabel = CSV_TEMPLATES.find(t => t.id === templateId)?.label || templateId;
  downloadCsv(rows, `${project.name}_${templateLabel}.csv`);
}

// ─── Legacy helpers (kept for backward compatibility) ─────────────────────────

const getStyle = (style: ExportStyle) => {
  switch (style) {
    case 'Minimal':      return { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 10 };
    case 'Modern':       return { fillColor: [241, 90, 36],   textColor: [255, 255, 255], fontSize: 11 };
    case 'Professional': return { fillColor: [26, 26, 26],    textColor: [255, 255, 255], fontSize: 10 };
  }
};

export const generatePDF = (data: ExportData, style: ExportStyle = 'Modern') => {
  const doc = new jsPDF();
  const styleConfig = getStyle(style);
  doc.setFontSize(18);
  doc.text(COMPANY, 105, 15, { align: 'center' });
  doc.setFontSize(14);
  doc.text(data.title, 105, 22, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Proyecto: ${data.projectName} | Cliente: ${data.clientName}`, 14, 30);
  (doc as any).autoTable({
    head: [data.headers],
    body: data.rows,
    startY: 35,
    headStyles: { fillColor: styleConfig.fillColor, textColor: styleConfig.textColor },
    styles: { fontSize: styleConfig.fontSize },
  });
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.text(FOOTER_SLOGAN, 105, pageHeight - 20, { align: 'center' });
  doc.text(`📍 ${FOOTER_ADDRESS} | 📱 (W) ${FOOTER_PHONES} | ✉️ ${FOOTER_EMAILS}`, 105, pageHeight - 15, { align: 'center' });
  doc.save(`${data.projectName}_${data.title}.pdf`);
};

export const generateCSV = (data: ExportData) => {
  const csvData = [data.headers, ...data.rows];
  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${data.projectName}_${data.title}.csv`;
  link.click();
};

export const exportToExcel = (data: ExportData) => {
  const rows = [
    [`${data.title} - ${data.projectName}`],
    [`Cliente: ${data.clientName}`],
    [],
    data.headers,
    ...data.rows,
    [],
    [FOOTER_SLOGAN],
    [FOOTER_ADDRESS],
  ];
  const BOM = '\uFEFF';
  const csv = Papa.unparse(rows, { delimiter: ';' });
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${data.projectName}_${data.title}.xlsx`;
  link.click();
};
