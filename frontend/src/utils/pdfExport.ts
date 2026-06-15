import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

const BRAND_COLOR: [number, number, number] = [26, 154, 145]; // #1A9A91

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

const drawHeader = (doc: jsPDF, logo: string, title: string, subtitle: string) => {
  if (logo) {
    // Add logo (assuming it's square)
    doc.addImage(logo, 'PNG', 14, 10, 20, 20);
  }
  
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('ERANAD', logo ? 40 : 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('Beverages Manufacturing Execution System', logo ? 40 : 14, 25);
  doc.text('Ernad, Kerala, India', logo ? 40 : 14, 30);
  
  // Right side info
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(title, pageWidth - 14, 20, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(subtitle, pageWidth - 14, 26, { align: 'right' });
  doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, pageWidth - 14, 31, { align: 'right' });
  
  // Separator line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(14, 35, pageWidth - 14, 35);
  
  return 45; // return current Y position
};


export const generateProductionPDF = async (dateRange: any, data: any) => {
  const doc = new jsPDF();
  const logo = await getLogoBase64();
  
  const formatNum = (num: number) => Number(num || 0).toLocaleString();
  const formatDec = (num: number) => Number(num || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const { reportData = [], batchesData = [] } = data;

  // If no lines found, just show a blank report
  if (reportData.length === 0) {
    drawHeader(doc, logo, 'PRODUCTION OPERATIONS LEDGER', `Period: ${dateRange.start} to ${dateRange.end}`);
    doc.setFontSize(12);
    doc.text('No production data found for this period.', 14, 60);
    doc.save(`Eranad_Production_Ledger_${dateRange.start}_to_${dateRange.end}.pdf`);
    return;
  }

  reportData.forEach((lineRecord: any, index: number) => {
    if (index > 0) {
      doc.addPage();
    }
    
    let currentY = drawHeader(doc, logo, `PRODUCTION LEDGER - ${lineRecord.lineName}`, `Period: ${dateRange.start} to ${dateRange.end}`);
    
    const checkPageBreak = (neededSpace: number) => {
      if (currentY + neededSpace > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        currentY = 20;
      }
    };

    // SECTION 1: PRODUCTION DETAILS
    const lineBatches = batchesData.filter((b: any) => b.lineName === lineRecord.lineName);
    
    checkPageBreak(40);
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('SECTION 1: PRODUCTION DETAILS', 14, currentY);
    
    if (lineBatches.length > 0) {
      autoTable(doc, {
        head: [["Batch Number", "SKU", "Start Time", "End Time", "Produced Cases", "Rejected Material Count"]],
        body: lineBatches.map((item: any) => [
          item.batchCode || '-',
          item.productName || '-',
          item.startTime ? format(new Date(item.startTime), 'MMM dd, HH:mm') : '-',
          item.endTime ? format(new Date(item.endTime), 'MMM dd, HH:mm') : 'Ongoing',
          formatNum(item.casesTotal),
          formatNum(item.scrapTotal)
        ]),
        startY: currentY + 5,
        theme: 'grid',
        headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 9, cellPadding: 3 },
        margin: { left: 14, right: 14 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('No production batches recorded for this line during the period.', 14, currentY + 8);
      currentY += 20;
    }

    // SECTION 2: MATERIAL WASTAGE ANALYSIS
    checkPageBreak(40);
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('SECTION 2: MATERIAL WASTAGE ANALYSIS', 14, currentY);
    
    const { lineMaterialWastage = [] } = data;
    const lineWastage = lineMaterialWastage.filter((w: any) => w.lineName === lineRecord.lineName);
    
    if (lineWastage.length > 0) {
      autoTable(doc, {
        head: [["Material Name", "Material Code", "Unit", "Total Consumed", "Total Wastage", "Variance %"]],
        body: lineWastage.map((item: any) => [
          item.materialName || '-',
          item.materialCode || '-',
          item.unit || '-',
          formatDec(item.totalConsumed),
          formatDec(item.totalWastage),
          `${formatDec(item.variance)}%`
        ]),
        startY: currentY + 5,
        theme: 'grid',
        headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 9, cellPadding: 3 },
        margin: { left: 14, right: 14 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('No material wastage recorded for this line during the period.', 14, currentY + 8);
      currentY += 20;
    }
  });

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
    doc.text(`Generated from ERNAD MES • Ernad, Kerala, India`, 14, doc.internal.pageSize.getHeight() - 6);
    doc.text(`Page ${i} of ${pages.length - 1}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
  }

  doc.save(`Eranad_Production_Ledger_${dateRange.start}_to_${dateRange.end}.pdf`);
};
export const generateSalesPDF = async (dateRange: any, salesData: any) => {
  const doc = new jsPDF();
  const logo = await getLogoBase64();
  
  let currentY = drawHeader(doc, logo, 'Market Intelligence & Sales', `Period: ${dateRange.start} to ${dateRange.end}`);

  const summary = salesData?.summary || { totalRevenue: 0, orderCount: 0, avgOrderValue: 0 };
  
  // Executive KPI blocks
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Key Performance Indicators', 14, currentY);
  
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Gross Revenue: $${(Number(summary.totalRevenue) / 1000).toFixed(1)}k`, 14, currentY + 8);
  doc.text(`Total Fulfilled Orders: ${summary.orderCount}`, 80, currentY + 8);
  doc.text(`Average Ticket Size: $${Math.round(summary.avgOrderValue)}`, 140, currentY + 8);
  
  currentY += 20;
  
  if (salesData?.topProducts && salesData.topProducts.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Top Performing SKUs (Product Matrix)', 14, currentY);
    
    const prodCols = ["Product Name", "Category/Brand", "Quantity Sold", "Current Stock", "Gross Revenue ($)"];
    const prodRows = salesData.topProducts.map((prod: any) => [
      prod.productName || '-',
      prod.brandName || 'Beverages',
      prod.quantity?.toLocaleString() || '0',
      prod.currentStock?.toLocaleString() || '0',
      (Number(prod.revenue) / 1000).toFixed(1) + 'k'
    ]);
    
    autoTable(doc, {
      head: [prodCols],
      body: prodRows,
      startY: currentY + 5,
      theme: 'grid',
      headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 9, cellPadding: 4 },
      margin: { left: 14, right: 14 }
    });
  }
  
  doc.save(`Eranad_Sales_Report_${dateRange.start}_to_${dateRange.end}.pdf`);
};

export const generateBatchAuditPDF = async (metadata: any, totals: any, logs: any[], station: string) => {
  const doc = new jsPDF();
  const logo = await getLogoBase64();
  
  const batchCode = metadata?.batch?.batchCode || 'Unknown';
  let currentY = drawHeader(doc, logo, `Batch Audit: ${batchCode}`, `Station: ${station}`);

  // Batch Metadata
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Batch Details', 14, currentY);
  
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Status: ${metadata?.batch?.status || '-'}`, 14, currentY + 7);
  doc.text(`Line: ${metadata?.line?.name || '-'}`, 14, currentY + 12);
  doc.text(`Brand/Product: ${metadata?.brand?.name || '-'} / ${metadata?.product?.name || '-'}`, 14, currentY + 17);
  doc.text(`Start Time: ${metadata?.batch?.startTime ? format(new Date(metadata.batch.startTime), 'MMM dd, yyyy HH:mm') : '-'}`, 14, currentY + 22);

  // Totals
  doc.text(`Total Output: ${(totals?.packingTotal || 0).toLocaleString()} Units`, 120, currentY + 7);
  doc.text(`Total Scrap: ${Number(totals?.scrapTotal || 0).toLocaleString()} Units`, 120, currentY + 12);
  
  currentY += 35;
  
  // Audit Logs
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`Forensic Event Ledger - ${station}`, 14, currentY);
  
  if (logs && logs.length > 0) {
    const logCols = ["Time", "Remarks", "Operator", "Material Usage", "Output", "Wastage"];
    const logRows = logs.map((log: any) => {
      let materialUsageStr = '';
      const currentStationId = (log.station || station).toUpperCase();
      if (currentStationId === 'PACKING') {
        if (log.selectedShrinks && log.selectedShrinks.length > 0) {
          materialUsageStr = log.selectedShrinks.map((s: any) => `${s.shrinkName}: ${s.mmUsed} KG${s.wastageKg ? ` (W: ${s.wastageKg} KG)` : ''}`).join('\n');
        } else if (log.shrinkWeightUsed && Number(log.shrinkWeightUsed) > 0) {
          materialUsageStr = `Shrink: ${log.shrinkWeightUsed} KG`;
        }
      } else if (currentStationId === 'BLOWING') {
        if (log.bagsUsed && Number(log.bagsUsed) > 0) {
          materialUsageStr = `${log.bagsUsed} Bags`;
        }
      } else if (currentStationId === 'FILLING') {
        if (log.capUsage && Number(log.capUsage) > 0) {
          materialUsageStr = `${log.capUsage} Caps`;
        }
      } else if (currentStationId === 'LABELING') {
        if (log.bopRollUsage && Number(log.bopRollUsage) > 0) {
          materialUsageStr = `${log.bopRollUsage} KG`;
        }
      }

      let wastageStr = '';
      if (currentStationId === 'PACKING') {
        wastageStr = `${log.shrinkWastageKg !== undefined ? log.shrinkWastageKg : log.wastageCount} KG`;
      } else if (currentStationId === 'LABELING') {
        wastageStr = `${log.wastageCount} KG`;
      } else {
        wastageStr = log.wastageCount?.toLocaleString() || '0';
      }

      return [
        format(new Date(log.loggedAt), 'MMM dd, HH:mm:ss'),
        log.remarks || 'No remarks recorded',
        `${log.userName || log.user?.name || 'Operator'} ${log.updatedByName ? '(Revised)' : ''}`,
        materialUsageStr || '-',
        log.primaryCount?.toLocaleString() || '0',
        wastageStr
      ];
    });
    
    autoTable(doc, {
      head: [logCols],
      body: logRows,
      startY: currentY + 5,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 40 },
        2: { cellWidth: 30 },
        3: { cellWidth: 42 },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' }
      },
      margin: { left: 14, right: 14 }
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('No telemetry records found for this station.', 14, currentY + 10);
  }
  
  doc.save(`Audit_${batchCode}_${station}.pdf`);
};
