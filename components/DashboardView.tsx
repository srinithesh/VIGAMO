import React, { useState } from 'react';
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis, Cell } from 'recharts';
import { ProcessedVehicleData } from '../types';
import { CheckCircleIcon, WarningIcon, XCircleIcon, SparklesIcon, ProcessingIcon } from './Icons';
import { getComplianceSummary } from '../services/geminiService';

interface DashboardViewProps {
  data: ProcessedVehicleData[];
  onGenerateReport: () => void;
  onReset: () => void;
}

const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
        case 'active':
        case 'valid':
        case 'paid':
        case 'ok':
            return <CheckCircleIcon className="w-6 h-6 text-ev-orange" />;
        case 'expired':
        case 'due':
            return <XCircleIcon className="w-6 h-6 text-ev-pink" />;
        case 'suspicious':
        case 'potential charger fault':
            return <WarningIcon className="w-6 h-6 text-yellow-400" />;
        default:
            return <span className="text-ev-text-slate">-</span>;
    }
};

const ComplianceGauge: React.FC<{ score: number }> = ({ score }) => {
  const data = [{ name: 'score', value: score }];
  const color = score > 80 ? '#FF7B54' : score > 50 ? '#FBBF24' : '#FF4D6D';
  
  return (
    <div className="relative w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="70%"
          outerRadius="100%"
          data={data}
          startAngle={90}
          endAngle={-270}
          barSize={20}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{fill: '#233554'}} dataKey="value" angleAxisId={0} cornerRadius={10}>
             <Cell fill={color} className="shadow-glow-orange" filter="url(#glow)" />
          </RadialBar>
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute top-0 left-0 right-0 bottom-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold" style={{ color }}>
          {score.toFixed(0)}
        </span>
        <span className="text-lg text-ev-text-slate">/ 100</span>
      </div>
      <svg width="0" height="0">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
    </div>
  );
};


export const DashboardView: React.FC<DashboardViewProps> = ({ data, onGenerateReport, onReset }) => {
    const [summaries, setSummaries] = useState<Record<string, string>>({});
    const [loadingSummary, setLoadingSummary] = useState<string | null>(null);

    const overallScore = data.reduce((acc, v) => acc + v.compliance.score, 0) / (data.length || 1);
    const discrepancyData = data.filter(v => v.charging.discrepancyFlag !== 'OK');
    const violations = data.flatMap(v => v.compliance.overallStatus);

    const handleGenerateSummary = async (vehicleData: ProcessedVehicleData) => {
        if (loadingSummary === vehicleData.plate || summaries[vehicleData.plate]) return;
        setLoadingSummary(vehicleData.plate);
        try {
            const summary = await getComplianceSummary(vehicleData);
            setSummaries(prev => ({ ...prev, [vehicleData.plate]: summary }));
        } catch (error) {
            console.error("Failed to get AI summary:", error);
            setSummaries(prev => ({ ...prev, [vehicleData.plate]: "Error generating summary." }));
        } finally {
            setLoadingSummary(null);
        }
    };

    return (
    <div className="p-4 md:p-8 min-h-screen animate-fade-in">
        <header className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-ev-orange tracking-wider">COMPLIANCE ANALYSIS</h1>
            <button 
                onClick={onReset} 
                className="border border-ev-text-slate text-ev-text-slate px-4 py-2 rounded-md hover:border-ev-orange hover:text-ev-orange hover:shadow-glow-orange transition-all duration-300"
            >
                New Analysis
            </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Left Panel */}
            <div className="lg:col-span-2 xl:col-span-3 space-y-6">
                 {/* Unified Compliance Table */}
                 <div className="bg-ev-panel-blue/50 backdrop-blur-sm rounded-lg p-4 border border-ev-border-blue animate-slide-in-up">
                    <h2 className="text-xl font-semibold text-ev-light-gray mb-4">Unified Compliance Table</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="border-b-2 border-ev-border-blue text-ev-text-slate">
                                <tr>
                                    {['Plate', 'Vehicle', 'Helmet', 'Fine', 'Insurance', 'PUC', 'Tax', 'Charging', 'Status', 'AI Insights'].map(h => (
                                        <th key={h} className="p-3">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((v, i) => (
                                    <tr key={i} className="border-b border-ev-border-blue hover:bg-ev-panel-blue transition-colors">
                                        <td className="p-3 font-mono">{v.plate}</td>
                                        <td className="p-3">{v.vehicleType}</td>
                                        <td className="p-3">{v.helmet === null ? '—' : (v.helmet ? <CheckCircleIcon className="w-6 h-6 text-ev-orange" /> : <XCircleIcon className="w-6 h-6 text-ev-pink" />)}</td>
                                        <td className="p-3">{v.rto.pendingFine > 0 ? `₹${v.rto.pendingFine}` : '₹0'}</td>
                                        <td className="p-3">{getStatusIcon(v.compliance.insuranceStatus)}</td>
                                        <td className="p-3">{getStatusIcon(v.compliance.pucStatus)}</td>
                                        <td className="p-3">{getStatusIcon(v.compliance.taxStatus)}</td>
                                        <td className="p-3">{getStatusIcon(v.charging.discrepancyFlag)}</td>
                                        <td className="p-3 text-yellow-300">{v.compliance.overallStatus.length > 0 ? v.compliance.overallStatus[0] : 'OK'}</td>
                                        <td className="p-3 min-w-[200px]">
                                            {summaries[v.plate] ? (
                                                <div className="text-sm text-ev-light-gray/90 whitespace-pre-wrap font-mono">{summaries[v.plate]}</div>
                                            ) : (
                                                <button
                                                onClick={() => handleGenerateSummary(v)}
                                                disabled={!!loadingSummary}
                                                className="flex items-center gap-2 px-3 py-1 text-sm rounded-md bg-ev-orange/20 text-ev-orange hover:bg-ev-orange/40 disabled:opacity-50 disabled:cursor-wait transition-all"
                                                >
                                                {loadingSummary === v.plate ? (
                                                    <ProcessingIcon className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <SparklesIcon className="w-4 h-4" />
                                                )}
                                                {loadingSummary === v.plate ? 'Generating...' : 'Summarize'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Charging Discrepancy Summary */}
                {discrepancyData.length > 0 && (
                    <div className="bg-ev-panel-blue/50 backdrop-blur-sm rounded-lg p-4 border border-ev-border-blue animate-slide-in-up" style={{ animationDelay: '200ms'}}>
                        <h2 className="text-xl font-semibold text-ev-light-gray mb-4">Charging Discrepancy Detections</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="border-b-2 border-ev-border-blue text-ev-text-slate">
                                    <tr>
                                        {['Plate', 'Billed (kWh)', 'Detected (kWh)', 'Difference', 'Flag'].map(h => (
                                            <th key={h} className="p-3">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {discrepancyData.map((v, i) => (
                                        <tr key={i} className="border-b border-ev-border-blue bg-ev-pink/20 hover:bg-ev-pink/30 transition-colors">
                                            <td className="p-3 font-mono">{v.plate}</td>
                                            <td className="p-3">{v.charging.billed.toFixed(2)}</td>
                                            <td className="p-3">{v.charging.detected.toFixed(2)}</td>
                                            <td className={`p-3 font-bold ${v.charging.difference > 0 ? 'text-ev-pink' : 'text-yellow-400'}`}>{v.charging.difference.toFixed(2)}</td>
                                            <td className="p-3 text-yellow-400 flex items-center gap-2"><WarningIcon className="w-5 h-5" />{v.charging.discrepancyFlag}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Panel */}
            <div className="lg:col-span-1 xl:col-span-1 space-y-6">
                <div className="bg-ev-panel-blue/50 backdrop-blur-sm rounded-lg p-6 border border-ev-border-blue animate-slide-in-up" style={{ animationDelay: '100ms'}}>
                    <h2 className="text-xl font-semibold text-ev-light-gray mb-4 text-center">Overall Compliance Score</h2>
                    <ComplianceGauge score={overallScore} />
                </div>
                <div className="bg-ev-panel-blue/50 backdrop-blur-sm rounded-lg p-6 border border-ev-border-blue animate-slide-in-up" style={{ animationDelay: '300ms'}}>
                    <h2 className="text-xl font-semibold text-ev-light-gray mb-4">Violations Summary</h2>
                    {violations.length > 0 ? (
                        <ul className="space-y-2 max-h-60 overflow-y-auto">
                            {violations.map((violation, i) => (
                                <li key={i} className="flex items-start gap-2 text-yellow-300">
                                    <WarningIcon className="w-5 h-5 mt-1 flex-shrink-0" />
                                    <span>{violation}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center py-4">
                            <CheckCircleIcon className="w-12 h-12 text-ev-orange mx-auto mb-2" />
                            <p className="text-ev-light-gray">No violations detected.</p>
                        </div>
                    )}
                </div>
                 <button onClick={onGenerateReport} className="w-full text-lg font-bold bg-ev-orange text-ev-dark-blue px-8 py-3 rounded-md hover:bg-ev-light-pink hover:shadow-glow-orange transition-all duration-300">
                    Generate Full Report
                </button>
            </div>
        </div>
    </div>
    );
};