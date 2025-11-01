
import React, { useState, useCallback } from 'react';
import { ProcessedVehicleData, Transaction, AiDetection, RtoData } from './types';
import { UploadView } from './components/UploadView';
import { DashboardView } from './components/DashboardView';
import { mockAiDetections, mockRtoDatabase, parseTransactions } from './services/mockData';
import { generateReport } from './services/pdfService';
import { ProcessingIcon } from './components/Icons';


const processData = (transactions: Transaction[], aiDetections: AiDetection[], rtoDatabase: Record<string, RtoData>): ProcessedVehicleData[] => {
    const discrepancyCounts: Record<string, number> = {};
    const suspiciousSessions = new Set<string>();
    
    // First pass for charging discrepancies
    transactions.forEach(tx => {
        const detection = aiDetections.find(d => d.plate === tx.plate);
        if (detection) {
            const difference = tx.billedKwh - detection.detectedKwh;
            if (Math.abs(difference) > 2.0) { // Allow for a 2 kWh margin of error
                suspiciousSessions.add(tx.plate);
                discrepancyCounts[tx.chargerId] = (discrepancyCounts[tx.chargerId] || 0) + 1;
            }
        }
    });

    return transactions.map(tx => {
        const detection = aiDetections.find(d => d.plate === tx.plate) || {} as Partial<AiDetection>;
        const rto = rtoDatabase[tx.plate] || {} as Partial<RtoData>;

        const difference = tx.billedKwh - (detection.detectedKwh || tx.billedKwh);
        let discrepancyFlag: ProcessedVehicleData['charging']['discrepancyFlag'] = 'OK';
        if (discrepancyCounts[tx.chargerId] >= 3) {
            discrepancyFlag = 'Potential Charger Fault';
        } else if (suspiciousSessions.has(tx.plate)) {
            discrepancyFlag = 'Suspicious';
        }
        
        let score = 100;
        const overallStatus: string[] = [];
        
        const isRegValid = new Date(rto.registrationValidTill || 0) > new Date();
        const isPucValid = new Date(rto.pollutionValidTill || 0) > new Date();
        
        if (!isRegValid) { score -= 20; overallStatus.push(`Reg Expired for ${tx.plate}`); }
        if (rto.insuranceStatus !== 'Active') { score -= 20; overallStatus.push(`Insurance Expired for ${tx.plate}`); }
        if (!isPucValid) { score -= 20; overallStatus.push(`PUC Expired for ${tx.plate}`); }
        if (rto.pendingFine > 0) { score -= 20; overallStatus.push(`Fine Pending: ₹${rto.pendingFine} on ${tx.plate}`); }
        if (rto.roadTaxStatus !== 'Paid') { score -= 20; overallStatus.push(`Tax Due for ${tx.plate}`); }
        if (discrepancyFlag !== 'OK') { score -= 20; overallStatus.push(`Charging Discrepancy on ${tx.plate}`); }
        if (detection.vehicleType === '2-Wheeler' && !detection.helmet) {
            overallStatus.push(`No Helmet on ${tx.plate}`);
        }
        
        return {
            plate: tx.plate,
            vehicleType: detection.vehicleType || 'Other',
            helmet: detection.helmet === undefined ? null : detection.helmet,
            rto: rto as RtoData,
            charging: {
                billed: tx.billedKwh,
                detected: detection.detectedKwh || tx.billedKwh,
                difference,
                discrepancyFlag,
            },
            compliance: {
                score: Math.max(0, score),
                fineStatus: rto.pendingFine > 0 ? `₹${rto.pendingFine}` : 'OK',
                insuranceStatus: rto.insuranceStatus || 'Expired',
                pucStatus: isPucValid ? 'Valid' : 'Expired',
                taxStatus: rto.roadTaxStatus || 'Due',
                registrationStatus: isRegValid ? 'Valid' : 'Expired',
                overallStatus,
            }
        };
    });
};

const LoadingOverlay: React.FC = () => (
    <div className="fixed inset-0 bg-rich-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
        <ProcessingIcon className="w-24 h-24 text-caribbean-green animate-spin" />
        <p className="text-2xl text-anti-flash-white mt-4 tracking-widest animate-pulse-slow">ANALYZING DATA...</p>
    </div>
);


function App() {
    const [isLoading, setIsLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<ProcessedVehicleData[] | null>(null);

    const handleAnalyze = useCallback((videoFile: File, transactionLog: string) => {
        setIsLoading(true);
        // Simulate async processing
        setTimeout(() => {
            try {
                const transactions = parseTransactions(transactionLog);
                const processed = processData(transactions, mockAiDetections, mockRtoDatabase);
                setAnalysisResult(processed);
            } catch (error) {
                console.error("Failed to process data:", error);
                alert("There was an error parsing the transaction log. Please check the file format.");
            } finally {
                setIsLoading(false);
            }
        }, 2000);
    }, []);

    const handleGenerateReport = useCallback(() => {
        if (analysisResult) {
            generateReport(analysisResult);
        }
    }, [analysisResult]);

    const handleReset = useCallback(() => {
        setAnalysisResult(null);
    }, []);

    return (
        <div className="min-h-screen">
            {isLoading && <LoadingOverlay />}
            {analysisResult ? (
                <DashboardView data={analysisResult} onGenerateReport={handleGenerateReport} onReset={handleReset} />
            ) : (
                <UploadView onAnalyze={handleAnalyze} isLoading={isLoading} />
            )}
        </div>
    );
}

export default App;