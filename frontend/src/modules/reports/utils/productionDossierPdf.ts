import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

const BRAND_COLOR: [number, number, number] = [26, 154, 145]; // #1A9A91 (Teal)

const getLogoBase64 = async (): Promise<string> => {
  try {
    const response = await fetch('/android-chrome-192x192.png');
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    return '';
  }
};

export async function generateProductionDossierPdf(data: any, params: any) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  const logo = await getLogoBase64();

  const formatNum = (num: number) => Number(num || 0).toLocaleString();
  const formatDec = (num: number) => Number(num || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Add Page Hook for Header/Footer
  const addHeaderFooter = (currentPage: number, pageCount: number) => {
    // Header
    if (logo) {
      doc.addImage(logo, 'PNG', 14, 10, 20, 20);
    }
    
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont('helvetica', 'bold');
    doc.text('ERNAD', logo ? 40 : 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFont('helvetica', 'normal');
    doc.text('Beverages Manufacturing Execution System', logo ? 40 : 14, 25);
    doc.text('Ernad, Kerala, India', logo ? 40 : 14, 30);
    
    // Right side info
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('PRODUCTION DOSSIER', pageWidth - 14, 20, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    
    const dateStr = `${format(new Date(params?.startDate || Date.now()), 'dd-MMM-yyyy')} to ${format(new Date(params?.endDate || Date.now()), 'dd-MMM-yyyy')}`;
    doc.text(`Period: ${dateStr}`, pageWidth - 14, 26, { align: 'right' });
    doc.text(`Generated: ${format(new Date(), 'dd-MMM-yyyy HH:mm')}`, pageWidth - 14, 31, { align: 'right' });
    
    // Separator line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 35, pageWidth - 14, 35);

    // Footer
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
    
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('ERNAD MES - Production Dossier Report', 14, pageHeight - 10);
    doc.text(`Generated automatically by Ernad Manufacturing Execution System`, 14, pageHeight - 6);
    doc.text(`Page ${currentPage} of ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
  };

  let startY = 45;

  // 1. Batch Information Grid
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('Batch Identity', 14, startY);
  
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  const batchCodes = data?.batches?.join(', ') || 'N/A';
  doc.text(`Batch: ${batchCodes}`, 14, startY + 7);
  doc.text(`Product: ${params?.productName || 'N/A'}`, 14, startY + 12);
  doc.text(`Line: ${params?.lineName || 'N/A'}`, 14, startY + 17);
  
  startY += 30;

  // 2. Executive Summary KPIs
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', 14, startY);
  startY += 7;

  const kpis = [
    { label: 'Produced Cases', val: formatNum(data?.summary?.producedCases) },
    { label: 'Produced Units', val: formatNum(data?.summary?.producedUnits) },
    { label: 'Rejected Units', val: formatDec(data?.summary?.rejectedUnits) },
    { label: 'Quality Yield', val: `${formatDec(data?.summary?.qualityYield)}%` },
    { label: 'Dispatch Qty', val: formatNum(data?.summary?.dispatchQty) },
  ];

  const kpiWidth = (pageWidth - 28 - (kpis.length - 1) * 5) / kpis.length;
  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (kpiWidth + 5);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, startY, kpiWidth, 18, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(kpi.label.toUpperCase(), x + 3, startY + 5);
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(kpi.val, x + 3, startY + 13);
  });

  startY += 28;

  // 3. Station Analysis Table
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Station Analysis', 14, startY);
  startY += 5;

  autoTable(doc, {
    startY,
    head: [['Station', 'Output', 'Waste', 'Yield %']],
    body: (data?.stationAnalysis || []).map((s: any) => [
      s.station,
      formatNum(s.output),
      formatDec(s.waste),
      `${formatDec(s.yieldPct)}%`
    ]),
    theme: 'grid',
    headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right' },
      2: { halign: 'right', textColor: [225, 29, 72] }, // Rose 600
      3: { halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  });

  startY = (doc as any).lastAutoTable.finalY + 15;

  // 4. Raw Material Consumption
  if (startY > pageHeight - 60) { doc.addPage(); startY = 35; }
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('RAW MATERIAL CONSUMPTION', 15, startY);
  startY += 5;

  autoTable(doc, {
    startY,
    head: [['Material', 'Unit', 'Consumed', 'Current Stock']],
    body: (data?.materialConsumption || []).map((m: any) => [
      m.materialName,
      m.unit,
      formatDec(m.consumed),
      formatDec(m.currentStock || 0)
    ]),
    theme: 'grid',
    headStyles: { fillColor: BRAND_COLOR, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      2: { halign: 'right' },
      3: { halign: 'right', textColor: [100, 116, 139] }
    },
    margin: { left: 15, right: 15 }
  });

  startY = (doc as any).lastAutoTable.finalY + 15;

  // 5. Production Logs
  if (startY > pageHeight - 80) { doc.addPage(); startY = 35; }
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('PRODUCTION LOGS', 15, startY);
  startY += 5;

  autoTable(doc, {
    startY,
    head: [['Date', 'Time', 'Station', 'Operator', 'Output', 'Waste']],
    body: (data?.logs || []).map((l: any) => [
      format(new Date(l.loggedAt), 'dd-MMM-yyyy'),
      format(new Date(l.loggedAt), 'hh:mm a'),
      l.station,
      'System / Operator', // Operator name not explicitly in details logs currently
      formatNum(l.primaryCount),
      formatDec(l.wastageCount)
    ]),
    theme: 'grid',
    headStyles: { fillColor: BRAND_COLOR, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right', textColor: [225, 29, 72] }
    },
    margin: { left: 15, right: 15 }
  });

  startY = (doc as any).lastAutoTable.finalY + 20;

  // 6. Signatures (ensure they don't break across pages)
  if (startY > pageHeight - 50) { doc.addPage(); startY = 35; }

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('APPROVALS', 15, startY);
  
  startY += 25;
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.line(15, startY, 65, startY);
  doc.line(80, startY, 130, startY);
  doc.line(145, startY, 195, startY);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Prepared By', 40, startY + 5, { align: 'center' });
  doc.text('Production Manager', 105, startY + 5, { align: 'center' });
  doc.text('Factory Supervisor', 170, startY + 5, { align: 'center' });

  // Add Page Hooks
  const pages = doc.internal.pages;
  for (let i = 1; i < pages.length; i++) {
    doc.setPage(i);
    addHeaderFooter(i, pages.length - 1);
  }

  // Save the PDF
  doc.save(`Production_Dossier_PD-${data?.batches?.[0] || 'MULTI'}.pdf`);
}
