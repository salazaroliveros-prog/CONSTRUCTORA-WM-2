/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Project, Typology } from '../constants';

export const generateBudgetPDF = (project: Project) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header - Branding
  doc.setFillColor(26, 26, 26); // #1A1A1A
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('CONSTRUCTORA WM/M&S', 15, 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('CONSTRUYENDO EL FUTURO', 15, 30);
  
  doc.text('PRESUPUESTO DE OBRA', pageWidth - 15, 20, { align: 'right' });
  doc.text(`Fecha: ${new Date().toLocaleDateString()}`, pageWidth - 15, 30, { align: 'right' });

  // Project Info
  doc.setTextColor(26, 26, 26);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL PROYECTO', 15, 55);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Proyecto: ${project.name}`, 15, 65);
  doc.text(`Cliente: ${project.clientName}`, 15, 71);
  doc.text(`Tipología: ${project.typology}`, 15, 77);
  doc.text(`Estado: ${project.status}`, 15, 83);

  // Totals Summary
  const total = project.items.reduce((acc, item) => {
    const materialsTotal = item.materials.reduce((mAcc, m) => mAcc + (m.price * m.quantity), 0);
    const laborTotal = item.labor.reduce((lAcc, l) => lAcc + (l.price * l.quantity), 0);
    return acc + (materialsTotal + laborTotal) * item.projectQuantity;
  }, 0);

  doc.setFillColor(241, 90, 36); // #F15A24
  doc.rect(pageWidth - 85, 55, 70, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('COSTO TOTAL ESTIMADO', pageWidth - 50, 65, { align: 'center' });
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`$ ${total.toLocaleString()}`, pageWidth - 50, 75, { align: 'center' });

  // Items Table
  const tableRows = project.items.map((item, index) => {
    const matSum = item.materials.reduce((acc, m) => acc + (m.price * m.quantity), 0);
    const labSum = item.labor.reduce((acc, l) => acc + (l.price * l.quantity), 0);
    const unitTotal = matSum + labSum;
    const subTotal = unitTotal * item.projectQuantity;
    
    return [
      index + 1,
      item.code,
      item.description,
      item.unit,
      item.projectQuantity,
      `$ ${unitTotal.toLocaleString()}`,
      `$ ${subTotal.toLocaleString()}`
    ];
  });

  autoTable(doc, {
    startY: 95,
    head: [['#', 'Cód', 'Descripción', 'Und', 'Cant', 'V. Unit', 'Subtotal']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [26, 26, 26], fontStyle: 'bold' },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 20 },
      6: { fontStyle: 'bold', halign: 'right' }
    }
  });

  // Footer
  const finalY = (doc as any).lastAutoTable.finalY + 20;
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.text('Este presupuesto es una estimación basada en rendimientos estándar.', 15, finalY);
  doc.text('Validado por el motor de cálculo CONSTRUCTORA WM/M&S', 15, finalY + 5);

  doc.save(`Presupuesto_${project.name.replace(/\s/g, '_')}.pdf`);
};

export const generateBudgetCSV = (project: Project) => {
  const headers = ['Coding', 'Description', 'Unit', 'Quantity', 'Unit Value', 'Total'];
  const rows = project.items.map(item => {
    const matSum = item.materials.reduce((acc, m) => acc + (m.price * m.quantity), 0);
    const labSum = item.labor.reduce((acc, l) => acc + (l.price * l.quantity), 0);
    const unitTotal = matSum + labSum;
    return [
      item.code,
      item.description,
      item.unit,
      item.projectQuantity,
      unitTotal,
      unitTotal * item.projectQuantity
    ];
  });

  const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `Presupuesto_${project.name}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
