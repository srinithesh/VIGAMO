
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { ProcessedVehicleData } from '../types';

export const generateReport = (data: ProcessedVehicleData[]) => {
  const doc = new jsPDF();
  const totalScore = data.reduce((acc, v) => acc + v.compliance.score, 0) / data.length;

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text("AI EV Fleet Compliance Report", 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 28, { align: 'center' });
  doc.text(`Overall Compliance Score: ${totalScore.toFixed(2)} / 100`, 105, 36, { align: 'center' });


  // Compliance Details Table
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text("Unified Compliance Details", 14, 50);
  (doc as any).autoTable({
    startY: 55,
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
    headStyles: { fillColor: [17, 34, 64] }, // #112240
  });

  // Charging Discrepancy Analysis Table
  const discrepancyData = data.filter(v => v.charging.discrepancyFlag !== 'OK');
  if (discrepancyData.length > 0) {
    const finalY = (doc as any).lastAutoTable.finalY || 120;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("Charging Discrepancy Analysis", 14, finalY + 15);
    (doc as any).autoTable({
        startY: finalY + 20,
        head: [['Plate', 'Billed (kWh)', 'Detected (kWh)', 'Difference (kWh)', 'Flag']],
        body: discrepancyData.map(v => [
            v.plate,
            v.charging.billed.toFixed(2),
            v.charging.detected.toFixed(2),
            v.charging.difference.toFixed(2),
            v.charging.discrepancyFlag,
        ]),
        theme: 'grid',
        headStyles: { fillColor: [17, 34, 64] }, // #112240
    });
  }

  doc.save(`ev-compliance-report-${new Date().toISOString().split('T')[0]}.pdf`);
};