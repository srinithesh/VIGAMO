

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProcessedVehicleData, ReportSections } from '../types';

export const generateReport = (data: ProcessedVehicleData[], sections: ReportSections, summaries: Record<string, string>) => {
  const doc = new jsPDF();
  const totalScore = data.reduce((acc, v) => acc + v.compliance.score, 0) / data.length;

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text("AI Vehicle Compliance Report", 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 28, { align: 'center' });
  doc.text(`Overall Compliance Score: ${totalScore.toFixed(2)} / 100`, 105, 36, { align: 'center' });

  let currentY = 50;

  // Compliance Details Table
  if (sections.includeComplianceDetails) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("Unified Compliance Details", 14, currentY);
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Plate', 'Vehicle', 'Helmet', 'Fine (₹)', 'Insurance', 'PUC', 'Tax', 'Charging']],
      body: data.map(v => [
        v.plate,
        v.vehicleType,
        v.helmet === null ? 'N/A' : (v.helmet ? 'Yes' : 'No'),
        v.rto.pendingFine,
        v.compliance.insuranceStatus,
        v.compliance.pucStatus,
        v.compliance.taxStatus,
        v.charging.discrepancyFlag,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [9, 98, 76] }, // #09624C (Bangladesh Green)
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;
  }
  

  // Charging Discrepancy Analysis Table
  const discrepancyData = data.filter(v => v.charging.discrepancyFlag !== 'OK');
  if (sections.includeChargingDiscrepancies && discrepancyData.length > 0) {
    if (currentY > 250) { // Check for page break
        doc.addPage();
        currentY = 20;
    }
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("Charging Discrepancy Analysis", 14, currentY);
    autoTable(doc, {
        startY: currentY + 5,
        head: [['Plate', 'Billed (kWh)', 'Detected (kWh)', 'Difference (kWh)', 'Flag']],
        body: discrepancyData.map(v => [
            v.plate,
            v.charging.billed.toFixed(2),
            v.charging.detected.toFixed(2),
            v.charging.difference.toFixed(2),
            v.charging.discrepancyFlag,
        ]),
        theme: 'grid',
        headStyles: { fillColor: [9, 98, 76] }, // #09624C (Bangladesh Green)
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // Detailed Vehicle Insights Section
  if (sections.includeDetailedInsights && data.length > 0) {
    // Start on a new page if there isn't much space left
    if (currentY > 150) {
        doc.addPage();
        currentY = 20;
    } else if (currentY > 20) {
        currentY += 10;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("Detailed Vehicle Insights", 14, currentY);
    currentY += 10;

    data.forEach(v => {
        const detailHeight = 50 + (summaries[v.plate] ? (doc.splitTextToSize(summaries[v.plate], 180).length * 4) : 0);
        if (currentY + detailHeight > 280) { // Check for page break before each vehicle
            doc.addPage();
            currentY = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`Vehicle: ${v.plate}`, 14, currentY);
        currentY += 8;

        autoTable(doc, {
            startY: currentY,
            body: [
                ['Owner', v.rto.owner],
                ['Registration', `${v.compliance.registrationStatus} (til ${v.rto.registrationValidTill})`],
                ['PUC', `${v.compliance.pucStatus} (til ${v.rto.pollutionValidTill})`],
                ['Insurance', v.compliance.insuranceStatus],
                ['Road Tax', v.compliance.taxStatus],
                ['Pending Fine', v.rto.pendingFine > 0 ? `₹${v.rto.pendingFine} (${v.rto.fineReason})` : 'None'],
            ],
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: 1 },
            columnStyles: { 0: { fontStyle: 'bold' } },
        });

        currentY = (doc as any).lastAutoTable.finalY + 5;

        if (summaries[v.plate]) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('AI Summary:', 14, currentY);
            currentY += 6;
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            const splitSummary = doc.splitTextToSize(summaries[v.plate], 180);
            doc.text(splitSummary, 14, currentY);
            currentY += splitSummary.length * 4 + 5;
        }

        currentY += 5;
    });
  }

  doc.save(`compliance-report-${new Date().toISOString().split('T')[0]}.pdf`);
};