import * as fs from 'fs';
import * as path from 'path';

const file = 'c:/Users/siinaan/Desktop/ernad/frontend/src/utils/pdfExport.ts';
let code = fs.readFileSync(file, 'utf-8');

const newMethod = `
export const generateProductionPDF = async (dateRange: any, data: any) => {
  const doc = new jsPDF();
  const logo = await getLogoBase64();
  
  let currentY = drawHeader(doc, logo, 'PRODUCTION OPERATIONS LEDGER', \`Period: \${dateRange.start} to \${dateRange.end}\`);

  const formatNum = (num: number) => Number(num || 0).toLocaleString();
  const formatDec = (num: number) => Number(num || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const checkPageBreak = (neededSpace: number) => {
    if (currentY + neededSpace > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      currentY = 20;
    }
  };

  const { reportData = [], batchesData = [], materialConsumption = [], dispatchSummary = [], incidentSummary = [], topOperators = [] } = data;

  // 1. Executive Summary
  checkPageBreak(50);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', 14, currentY);
  
  currentY += 8;
  const totalCases = reportData.reduce((acc: number, r: any) => acc + Number(r.totalCases || 0), 0);
  const totalUnits = reportData.reduce((acc: number, r: any) => acc + Number(r.totalOutput || 0), 0);
  const totalRej = reportData.reduce((acc: number, r: any) => acc + Number(r.totalWastage || 0), 0);
  const totalDisp = dispatchSummary.reduce((acc: number, d: any) => acc + Number(d.cases || 0), 0);
  const avgYield = reportData.length > 0 ? reportData.reduce((acc: number, r: any) => acc + (100 - Number(r.rejectionRate || 0)), 0) / reportData.length : 100;
  
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.text(\`Total Active Lines: \${reportData.length}\`, 14, currentY);
  doc.text(\`Total Products: \${[...new Set(reportData.map((r: any) => r.productId))].length}\`, 70, currentY);
  doc.text(\`Total Incidents: \${incidentSummary.length}\`, 130, currentY);
  
  currentY += 8;
  doc.text(\`Produced Cases: \${formatNum(totalCases)}\`, 14, currentY);
  doc.text(\`Produced Units: \${formatNum(totalUnits)}\`, 70, currentY);
  doc.text(\`Total Rejections: \${formatNum(totalRej)}\`, 130, currentY);
  
  currentY += 8;
  doc.text(\`Dispatch Qty: \${formatNum(totalDisp)} Cases\`, 14, currentY);
  doc.text(\`Average Yield: \${formatDec(avgYield)}%\`, 70, currentY);
  
  currentY += 20;

  // 2. Line Performance Summary
  if (reportData.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('Line Performance Summary', 14, currentY);
    
    autoTable(doc, {
      head: [["Line", "Product", "Produced Cases", "Wastage", "Yield %", "Status"]],
      body: reportData.map((item: any) => [
        item.lineName || '-',
        item.productName || '-',
        formatNum(item.totalCases),
        formatNum(item.totalWastage),
        \`\${formatDec(100 - Number(item.rejectionRate || 0))}%\`,
        item.rejectionRate < 2 ? 'Optimal' : 'Warning'
      ]),
      startY: currentY + 5,
      theme: 'grid',
      headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 14, right: 14 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // 3. Product Performance Summary
  if (reportData.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('Product Performance Summary', 14, currentY);

    const productMap = new Map();
    reportData.forEach((item: any) => {
      if (!productMap.has(item.productId)) {
        productMap.set(item.productId, { name: item.productName, cases: 0, units: 0, waste: 0 });
      }
      const p = productMap.get(item.productId);
      p.cases += Number(item.totalCases || 0);
      p.units += Number(item.totalOutput || 0);
      p.waste += Number(item.totalWastage || 0);
    });

    autoTable(doc, {
      head: [["Product Name", "Produced Cases", "Produced Units", "Wastage", "Yield %"]],
      body: Array.from(productMap.values()).map((p: any) => [
        p.name,
        formatNum(p.cases),
        formatNum(p.units),
        formatNum(p.waste),
        \`\${formatDec((p.units + p.waste) > 0 ? (p.units / (p.units + p.waste)) * 100 : 100)}%\`
      ]),
      startY: currentY + 5,
      theme: 'grid',
      headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 14, right: 14 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // 4. Batch Performance Summary
  if (batchesData.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('Batch Performance Summary', 14, currentY);
    
    autoTable(doc, {
      head: [["Batch ID", "Line", "Product", "Date", "Cases", "Units", "Wastage", "Status"]],
      body: batchesData.map((item: any) => [
        item.batchCode || '-',
        item.lineName || '-',
        item.productName || '-',
        item.startTime ? format(new Date(item.startTime), 'MMM dd') : '-',
        formatNum(item.casesTotal),
        formatNum(item.packingTotal),
        formatNum(item.scrapTotal),
        item.status
      ]),
      startY: currentY + 5,
      theme: 'grid',
      headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 14, right: 14 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // 5. Raw Material Consumption
  if (materialConsumption.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('Raw Material Consumption', 14, currentY);
    
    autoTable(doc, {
      head: [["Material", "Unit", "Consumed", "Current Stock"]],
      body: materialConsumption.map((m: any) => [
        m.materialName,
        m.unit,
        formatDec(m.consumed),
        formatDec(m.currentStock)
      ]),
      startY: currentY + 5,
      theme: 'grid',
      headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 14, right: 14 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // 6. Dispatch Summary
  if (dispatchSummary.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('Dispatch Summary', 14, currentY);
    
    autoTable(doc, {
      head: [["Product", "Cases", "Date", "Reference", "Destination"]],
      body: dispatchSummary.map((d: any) => [
        d.productName || 'Unknown',
        formatNum(d.cases),
        format(new Date(d.date), 'MMM dd, HH:mm'),
        d.reference || '-',
        d.destination || '-'
      ]),
      startY: currentY + 5,
      theme: 'grid',
      headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 14, right: 14 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // 7. Incident Summary
  if (incidentSummary.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('Incident Summary', 14, currentY);
    
    autoTable(doc, {
      head: [["Date", "Line", "Category", "Severity", "Status"]],
      body: incidentSummary.map((i: any) => [
        format(new Date(i.date), 'MMM dd, HH:mm'),
        i.lineName || '-',
        i.category || '-',
        i.severity || '-',
        i.status || '-'
      ]),
      startY: currentY + 5,
      theme: 'grid',
      headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 14, right: 14 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // 8. Top Operators
  if (topOperators.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('Top Operators', 14, currentY);
    
    autoTable(doc, {
      head: [["Operator", "Line", "Logs", "Produced Units", "Produced Cases", "Avg Yield %"]],
      body: topOperators.map((o: any) => [
        o.operatorName || 'Unknown',
        o.lineName || '-',
        formatNum(o.totalLogs),
        formatNum(o.producedUnits),
        formatNum(o.producedCases),
        \`\${formatDec(o.yieldPct)}%\`
      ]),
      startY: currentY + 5,
      theme: 'grid',
      headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 14, right: 14 }
    });
  }

  // Add Page Hooks
  const pages = doc.internal.pages;
  for (let i = 1; i < pages.length; i++) {
    doc.setPage(i);
    // Footer
    doc.setDrawColor(226, 232, 240);
    doc.line(14, doc.internal.pageSize.getHeight() - 15, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 15);
    
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('ERNAD MES - Official Manufacturing Execution Report', 14, doc.internal.pageSize.getHeight() - 10);
    doc.text(\`Generated from ERNAD MES • Ernad, Kerala, India\`, 14, doc.internal.pageSize.getHeight() - 6);
    doc.text(\`Page \${i} of \${pages.length - 1}\`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
  }

  doc.save(\`Eranad_Production_Ledger_\${dateRange.start}_to_\${dateRange.end}.pdf\`);
};
`;

const startIndex = code.indexOf('export const generateProductionPDF');
const endIndex = code.indexOf('export const generateSalesPDF');

if (startIndex !== -1 && endIndex !== -1) {
  code = code.slice(0, startIndex) + newMethod + code.slice(endIndex);
  fs.writeFileSync(file, code);
  console.log('Successfully replaced generateProductionPDF');
} else {
  console.log('Could not find boundaries');
}
