import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Papa from 'papaparse';

export type ExportStyle = 'Modern' | 'Minimal' | 'Professional';

export interface ExportData {
  title: string;
  projectName: string;
  clientName: string;
  headers: string[];
  rows: any[][];
}

const FOOTER = {
  slogan: 'Calidad y Confianza en cada obra.',
  address: 'Municipio de Quesada',
  phones: '55606172 - 40601526',
  emails: 'salazaroliveros@gmail.com, multiserviciosdeguatemal@gmail.com'
};

const getStyle = (style: ExportStyle) => {
  switch (style) {
    case 'Minimal': return { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 10 };
    case 'Modern': return { fillColor: [241, 90, 36], textColor: [255, 255, 255], fontSize: 11 };
    case 'Professional': return { fillColor: [26, 26, 26], textColor: [255, 255, 255], fontSize: 10 };
  }
};

export const generatePDF = (data: ExportData, style: ExportStyle = 'Modern') => {
  const doc = new jsPDF();
  const styleConfig = getStyle(style);

  // Header
  doc.setFontSize(18);
  doc.text('Multiservicios de Guatemala', 105, 15, { align: 'center' });
  doc.setFontSize(14);
  doc.text(data.title, 105, 22, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Proyecto: ${data.projectName} | Cliente: ${data.clientName}`, 14, 30);

  // Body
  (doc as any).autoTable({
    head: [data.headers],
    body: data.rows,
    startY: 35,
    headStyles: { fillColor: styleConfig.fillColor, textColor: styleConfig.textColor },
    styles: { fontSize: styleConfig.fontSize },
  });

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.text(FOOTER.slogan, 105, pageHeight - 20, { align: 'center' });
  doc.text(`📍 ${FOOTER.address} | 📱 (W) ${FOOTER.phones} | ✉️ ${FOOTER.emails}`, 105, pageHeight - 15, { align: 'center' });

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
