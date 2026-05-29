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

export const generateProductionPDF = async (dateRange: any, reportData: any[], batchesData: any[]) => {
  const doc = new jsPDF();
  const logo = await getLogoBase64();
  
  let currentY = drawHeader(doc, logo, 'Production Operations Ledger', `Period: ${dateRange.start} to ${dateRange.end}`);

  // Summary Metrics
  if (reportData && reportData.length > 0) {
    const totalOutput = reportData.reduce((acc, r) => acc + Number(r.totalOutput || 0), 0);
    const totalWastage = reportData.reduce((acc, r) => acc + Number(r.totalWastage || 0), 0);
    
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Executive Summary', 14, currentY);
    
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Active Lines: ${reportData.length}`, 14, currentY + 7);
    doc.text(`Gross Factory Output: ${totalOutput.toLocaleString()} Units`, 14, currentY + 12);
    doc.text(`Total Factory Wastage: ${totalWastage.toLocaleString()} Units`, 14, currentY + 17);
    
    currentY += 25;
    
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Line Performance Summaries', 14, currentY);
    
    const summaryCols = ["Line", "Brand & Product", "Total Output", "Wastage", "Compliance", "Total Stops", "Critical Errors"];
    const summaryRows = reportData.map((item: any) => [
      item.lineName || '-',
      `${item.brandName || '-'} / ${item.productName || '-'}`,
      item.totalOutput?.toLocaleString() || '0',
      item.totalWastage?.toLocaleString() || '0',
      (100 - (item.rejectionRate || 0)).toFixed(2) + '%',
      item.totalIncidents?.toString() || '0',
      item.criticalIncidents?.toString() || '0'
    ]);

    autoTable(doc, {
      head: [summaryCols],
      body: summaryRows,
      startY: currentY + 5,
      theme: 'grid',
      headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 9, cellPadding: 4 },
      margin: { left: 14, right: 14 }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // Batches Register
  if (batchesData && batchesData.length > 0) {
    // Check if we need a new page
    if (currentY > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      currentY = 20;
    }
    
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Production Batches Register', 14, currentY);
    
    const batchCols = ["Batch Code", "Line", "Status", "Start Time", "End Time", "Output (Units)"];
    const batchRows = batchesData.map((item: any) => [
      item.batchCode || '-',
      item.lineName || '-',
      item.status || '-',
      item.startTime ? format(new Date(item.startTime), 'MMM dd, HH:mm') : '-',
      item.endTime ? format(new Date(item.endTime), 'MMM dd, HH:mm') : 'Active',
      item.packingTotal?.toString() || '0'
    ]);

    autoTable(doc, {
      head: [batchCols],
      body: batchRows,
      startY: currentY + 5,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 4 },
      margin: { left: 14, right: 14 }
    });
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
    const logCols = ["Time", "Event / Remarks", "Operator", "Output", "Wastage"];
    const logRows = logs.map((log: any) => [
      format(new Date(log.loggedAt), 'MMM dd, HH:mm:ss'),
      log.remarks || 'No remarks recorded',
      `${log.userName} ${log.updatedByName ? '(Revised)' : ''}`,
      log.primaryCount?.toLocaleString() || '0',
      log.wastageCount?.toLocaleString() || '0'
    ]);
    
    autoTable(doc, {
      head: [logCols],
      body: logRows,
      startY: currentY + 5,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 35 },
        2: { cellWidth: 40 },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' }
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
