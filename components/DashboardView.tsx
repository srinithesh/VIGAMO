

import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis, Cell } from 'recharts';
import { ProcessedVehicleData, ReportSections } from '../types';
import { CheckCircleIcon, WarningIcon, XCircleIcon, SparklesIcon, ProcessingIcon, ChevronDownIcon, CogIcon, SearchIcon } from './Icons';
import { getComplianceSummary, getOverallSuggestions } from '../services/geminiService';

interface DashboardViewProps {
  data: ProcessedVehicleData[];
  onGenerateReport: (data: ProcessedVehicleData[], sections: ReportSections) => void;
  onReset: () => void;
}

const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
        case 'active':
        case 'valid':
        case 'paid':
        case 'ok':
            return <CheckCircleIcon className="w-6 h-6 text-caribbean-green" />;
        case 'expired':
        case 'due':
            return <XCircleIcon className="w-6 h-6 text-frog" />;
        case 'suspicious':
        case 'potential charger fault':
            return <WarningIcon className="w-6 h-6 text-yellow-400" />;
        default:
            return <span className="text-stone">-</span>;
    }
};

const ComplianceGauge: React.FC<{ score: number }> = ({ score }) => {
  const data = [{ name: 'score', value: score }];
  const color = score > 80 ? '#00DF81' : score > 50 ? '#20C295' : '#D9534F'; // Caribbean Green, Mountain Meadow, Red for severe
  
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
          <RadialBar background={{fill: '#084533'}} dataKey="value" angleAxisId={0} cornerRadius={10}>
             <Cell fill={color} filter="url(#glow)" />
          </RadialBar>
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute top-0 left-0 right-0 bottom-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold" style={{ color }}>
          {score.toFixed(0)}
        </span>
        <span className="text-lg text-stone">/ 100</span>
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
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [filters, setFilters] = useState({
        compliance: 'all',
        vehicleType: 'all',
        charging: 'all'
    });
    const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);
    const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
    const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
    const [reportOptions, setReportOptions] = useState<ReportSections>({
        includeComplianceDetails: true,
        includeChargingDiscrepancies: true,
    });
    const [showReportOptions, setShowReportOptions] = useState(false);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [reviewedDiscrepancies, setReviewedDiscrepancies] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    const overallScore = data.reduce((acc, v) => acc + v.compliance.score, 0) / (data.length || 1);
    const discrepancyData = data.filter(v => v.charging.discrepancyFlag !== 'OK');
    const violations = data.flatMap(v => v.compliance.overallStatus);

    const vehicleTypes = useMemo(() => ['all', ...Array.from(new Set(data.map(v => v.vehicleType)))], [data]);

    const filteredData = useMemo(() => {
        return data.filter(v => {
            // Search filter
            if (searchQuery && !v.plate.toLowerCase().includes(searchQuery.toLowerCase())) return false;

            // Standard filters
            if (filters.compliance === 'violations' && v.compliance.overallStatus.length === 0) return false;
            if (filters.compliance === 'compliant' && v.compliance.overallStatus.length > 0) return false;
            if (filters.vehicleType !== 'all' && v.vehicleType !== filters.vehicleType) return false;
            if (filters.charging !== 'all' && v.charging.discrepancyFlag !== filters.charging) return false;

            // Date range filter
            if (dateRange.start || dateRange.end) {
                try {
                    const vehicleDate = new Date(v.timestamp);
                    if (isNaN(vehicleDate.getTime())) return false; // Invalid date in data

                    if (dateRange.start) {
                        const startDate = new Date(dateRange.start);
                        startDate.setHours(0, 0, 0, 0);
                        if (vehicleDate < startDate) return false;
                    }
                    
                    if (dateRange.end) {
                        const endDate = new Date(dateRange.end);
                        endDate.setHours(23, 59, 59, 999);
                        if (vehicleDate > endDate) return false;
                    }
                } catch (e) {
                    console.error("Error parsing date for filtering:", v.timestamp);
                    return false;
                }
            }

            return true;
        });
    }, [data, filters, dateRange, searchQuery]);

    const isDateFilterActive = dateRange.start || dateRange.end;

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const resetFilters = () => {
        setFilters({
            compliance: 'all',
            vehicleType: 'all',
            charging: 'all'
        });
        setDateRange({ start: '', end: '' });
        setSearchQuery('');
    };

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

     const handleGenerateSuggestions = async () => {
        setIsGeneratingSuggestions(true);
        setSuggestionsError(null);
        setAiSuggestions(null);
        try {
            const suggestions = await getOverallSuggestions(data);
            setAiSuggestions(suggestions);
        } catch (error) {
            console.error("Failed to get AI suggestions:", error);
            setSuggestionsError("Failed to generate AI suggestions. Please try again.");
        } finally {
            setIsGeneratingSuggestions(false);
        }
    };

    const allVisibleSelected = useMemo(() => {
        return filteredData.length > 0 && filteredData.every(v => selectedRows.has(v.plate));
    }, [filteredData, selectedRows]);

    const handleSelectAll = () => {
        const newSelection = new Set(selectedRows);
        if (allVisibleSelected) {
            filteredData.forEach(v => newSelection.delete(v.plate));
        } else {
            filteredData.forEach(v => newSelection.add(v.plate));
        }
        setSelectedRows(newSelection);
    };

    const handleRowSelect = (plate: string) => {
        const newSelection = new Set(selectedRows);
        if (newSelection.has(plate)) {
            newSelection.delete(plate);
        } else {
            newSelection.add(plate);
        }
        setSelectedRows(newSelection);
    };

    const handleReportOptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setReportOptions(prev => ({ ...prev, [name]: checked }));
    };
    
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setDateRange(prev => ({ ...prev, [name]: value }));
    };

    const handleReportGeneration = () => {
        const dataToReport = selectedRows.size > 0
            ? data.filter(v => selectedRows.has(v.plate))
            : filteredData;
        
        if (dataToReport.length > 0) {
            onGenerateReport(dataToReport, reportOptions);
        }
    };

    const handleMarkAllReviewed = () => {
        const platesToReview = discrepancyData.map(v => v.plate);
        setReviewedDiscrepancies(new Set([...reviewedDiscrepancies, ...platesToReview]));
    };

    const handleClearReviews = () => {
        setReviewedDiscrepancies(new Set());
    };

    const reportButtonText = selectedRows.size > 0
        ? `Generate Report for ${selectedRows.size} Vehicle(s)`
        : 'Generate Filtered Report';
    
    const isReportButtonDisabled = (selectedRows.size === 0 && filteredData.length === 0) || 
                                     (!reportOptions.includeComplianceDetails && !reportOptions.includeChargingDiscrepancies);


    const DetailRow: React.FC<{ vehicle: ProcessedVehicleData }> = ({ vehicle }) => {
        const formatDate = (dateString: string) => {
            try {
                return new Date(dateString).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                });
            } catch (e) {
                return dateString;
            }
        };

        return (
            <div className="p-4 bg-pine/50 space-y-4 animate-fade-in">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Card 1: RTO & Compliance */}
                    <div className="flex-1 bg-basil/20 p-4 rounded-lg border border-bangladesh-green/50">
                        <h4 className="font-bold text-caribbean-green mb-3 border-b border-bangladesh-green/30 pb-2">RTO & Compliance</h4>
                        <div className="space-y-2 text-sm">
                            <p><span className="font-semibold text-stone w-28 inline-block">Owner:</span> {vehicle.rto.owner}</p>
                            <p><span className="font-semibold text-stone w-28 inline-block">Registration:</span> {vehicle.compliance.registrationStatus} (til {formatDate(vehicle.rto.registrationValidTill)})</p>
                            <p><span className="font-semibold text-stone w-28 inline-block">PUC:</span> {vehicle.compliance.pucStatus} (til {formatDate(vehicle.rto.pollutionValidTill)})</p>
                            <p><span className="font-semibold text-stone w-28 inline-block">Insurance:</span> {vehicle.compliance.insuranceStatus}</p>
                            <p><span className="font-semibold text-stone w-28 inline-block">Road Tax:</span> {vehicle.compliance.taxStatus}</p>
                            <p><span className="font-semibold text-stone w-28 inline-block">Pending Fine:</span> {vehicle.rto.pendingFine > 0 ? `₹${vehicle.rto.pendingFine} (${vehicle.rto.fineReason})` : 'None'}</p>
                        </div>
                    </div>

                    {/* Card 2: Charging Analysis */}
                    <div className="flex-1 bg-basil/20 p-4 rounded-lg border border-bangladesh-green/50">
                        <h4 className="font-bold text-caribbean-green mb-3 border-b border-bangladesh-green/30 pb-2">Charging Analysis</h4>
                        <div className="space-y-2 text-sm">
                           <p><span className="font-semibold text-stone w-32 inline-block">Status:</span> {vehicle.charging.discrepancyFlag}</p>
                            <p><span className="font-semibold text-stone w-32 inline-block">Billed Power:</span> {vehicle.charging.billed.toFixed(2)} kWh</p>
                            <p><span className="font-semibold text-stone w-32 inline-block">Detected Power:</span> {vehicle.charging.detected.toFixed(2)} kWh</p>
                            <p><span className="font-semibold text-stone w-32 inline-block">Discrepancy:</span> <span className={Math.abs(vehicle.charging.difference) > 0.1 ? 'text-red-400 font-bold' : ''}>{vehicle.charging.difference.toFixed(2)} kWh</span></p>
                        </div>
                    </div>
                </div>
                
                {/* Card 3: AI Insights */}
                <div className="bg-basil/20 p-4 rounded-lg border border-bangladesh-green/50">
                    <h4 className="font-bold text-caribbean-green mb-3">AI Insights</h4>
                    <div>
                        {summaries[vehicle.plate] ? (
                            <div className="text-sm text-anti-flash-white/90 whitespace-pre-wrap font-mono bg-rich-black/30 p-3 rounded-md">{summaries[vehicle.plate]}</div>
                        ) : (
                            <button
                                onClick={() => handleGenerateSummary(vehicle)}
                                disabled={!!loadingSummary}
                                className="flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md bg-caribbean-green/20 text-caribbean-green hover:bg-caribbean-green/40 disabled:opacity-50 disabled:cursor-wait transition-all"
                            >
                                {loadingSummary === vehicle.plate ? (
                                    <ProcessingIcon className="w-4 h-4 animate-spin" />
                                ) : (
                                    <SparklesIcon className="w-4 h-4" />
                                )}
                                {loadingSummary === vehicle.plate ? 'Generating...' : 'Generate AI Summary'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
    <div className="p-4 md:p-8 min-h-screen animate-fade-in">
        <header className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-caribbean-green tracking-wider">COMPLIANCE ANALYSIS</h1>
            <button 
                onClick={onReset} 
                className="border border-stone text-stone px-4 py-2 rounded-md hover:border-caribbean-green hover:text-caribbean-green hover:shadow-glow-green transition-all duration-300"
            >
                New Analysis
            </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Left Panel */}
            <div className="lg:col-span-2 xl:col-span-3 space-y-6">
                 {/* Unified Compliance Table */}
                 <div className="bg-basil/30 backdrop-blur-sm rounded-lg p-4 border border-bangladesh-green animate-slide-in-up">
                    <h2 className="text-xl font-semibold text-anti-flash-white mb-4">Unified Compliance Table</h2>

                    {/* FILTERS */}
                    <div className="flex flex-col md:flex-row flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-bangladesh-green/50">
                        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4">
                            {/* Search Bar */}
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                    <SearchIcon className="w-5 h-5 text-stone" />
                                </span>
                                <input
                                    type="text"
                                    id="search-plate"
                                    placeholder="Search by Plate..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-basil/80 border border-bangladesh-green rounded-md pl-10 pr-3 py-1.5 w-full sm:w-48 text-anti-flash-white focus:ring-1 focus:ring-caribbean-green focus:outline-none transition-all"
                                    aria-label="Search by license plate"
                                />
                            </div>
                            
                            {/* Dropdown Filters */}
                            <div className="flex items-center gap-2">
                                <label htmlFor="compliance-filter" className="text-stone font-semibold text-sm">Status:</label>
                                <select
                                    id="compliance-filter"
                                    name="compliance"
                                    value={filters.compliance}
                                    onChange={handleFilterChange}
                                    className="bg-basil/50 border border-bangladesh-green rounded-md px-3 py-1.5 text-anti-flash-white focus:ring-1 focus:ring-caribbean-green focus:outline-none transition-all"
                                >
                                    <option value="all">All</option>
                                    <option value="violations">With Violations</option>
                                    <option value="compliant">Compliant</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <label htmlFor="vehicle-type-filter" className="text-stone font-semibold text-sm">Vehicle:</label>
                                <select
                                    id="vehicle-type-filter"
                                    name="vehicleType"
                                    value={filters.vehicleType}
                                    onChange={handleFilterChange}
                                    className="bg-basil/50 border border-bangladesh-green rounded-md px-3 py-1.5 text-anti-flash-white focus:ring-1 focus:ring-caribbean-green focus:outline-none transition-all"
                                >
                                    {vehicleTypes.map(type => (
                                        <option key={type} value={type}>{type === 'all' ? 'All Types' : type}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <label htmlFor="charging-filter" className="text-stone font-semibold text-sm">Charging:</label>
                                <select
                                    id="charging-filter"
                                    name="charging"
                                    value={filters.charging}
                                    onChange={handleFilterChange}
                                    className="bg-basil/50 border border-bangladesh-green rounded-md px-3 py-1.5 text-anti-flash-white focus:ring-1 focus:ring-caribbean-green focus:outline-none transition-all"
                                >
                                    <option value="all">All</option>
                                    <option value="OK">OK</option>
                                    <option value="Suspicious">Suspicious</option>
                                    <option value="Potential Charger Fault">Charger Fault</option>
                                </select>
                            </div>
                             {/* Date Filters */}
                            <div className="flex items-center gap-2">
                                <label htmlFor="start-date" className="text-stone font-semibold text-sm">Date:</label>
                                <input 
                                   type="date"
                                   id="start-date"
                                   name="start"
                                   value={dateRange.start}
                                   onChange={handleDateChange}
                                   className="bg-basil/80 border border-bangladesh-green rounded-md px-2 py-1.5 w-full text-anti-flash-white focus:ring-1 focus:ring-caribbean-green focus:outline-none"
                                   aria-label="Start Date"
                                />
                                <span className="text-stone">-</span>
                                <input 
                                   type="date"
                                   id="end-date"
                                   name="end"
                                   value={dateRange.end}
                                   onChange={handleDateChange}
                                   className="bg-basil/80 border border-bangladesh-green rounded-md px-2 py-1.5 w-full text-anti-flash-white focus:ring-1 focus:ring-caribbean-green focus:outline-none"
                                   aria-label="End Date"
                                />
                            </div>
                        </div>

                        <button
                            onClick={resetFilters}
                            className="text-sm text-stone hover:text-caribbean-green transition-colors font-semibold"
                        >
                            Reset Filters
                        </button>
                    </div>


                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="border-b-2 border-bangladesh-green text-stone">
                                <tr>
                                    <th className="p-3 w-12 text-center">
                                         <input
                                            type="checkbox"
                                            className="bg-transparent border-stone rounded focus:ring-caribbean-green text-caribbean-green cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                            checked={allVisibleSelected}
                                            onChange={handleSelectAll}
                                            disabled={filteredData.length === 0}
                                            aria-label="Select all visible vehicles"
                                        />
                                    </th>
                                    <th className="p-3 w-8"></th>
                                    {['Plate', 'Vehicle', 'Helmet', 'Fine', 'Insurance', 'PUC', 'Tax', 'Charging', 'Status'].map(h => (
                                        <th key={h} className="p-3">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.length > 0 ? (
                                    filteredData.map((v) => (
                                        <React.Fragment key={v.plate}>
                                            <tr 
                                                className="border-b border-bangladesh-green/50 hover:bg-forest transition-colors group"
                                            >
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="bg-transparent border-stone rounded focus:ring-caribbean-green text-caribbean-green cursor-pointer"
                                                        checked={selectedRows.has(v.plate)}
                                                        onChange={() => handleRowSelect(v.plate)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        aria-label={`Select vehicle ${v.plate}`}
                                                    />
                                                </td>
                                                <td 
                                                    className="p-3 text-center cursor-pointer"
                                                    onClick={() => setExpandedRow(expandedRow === v.plate ? null : v.plate)}
                                                >
                                                    <ChevronDownIcon className={`w-5 h-5 text-stone transition-transform transform group-hover:text-anti-flash-white ${expandedRow === v.plate ? 'rotate-180' : ''}`} />
                                                </td>
                                                <td className="p-3 font-mono">{v.plate}</td>
                                                <td className="p-3">{v.vehicleType}</td>
                                                <td className="p-3">{v.helmet === null ? '—' : (v.helmet ? <CheckCircleIcon className="w-6 h-6 text-caribbean-green" /> : <XCircleIcon className="w-6 h-6 text-red-500" />)}</td>
                                                <td className="p-3">{v.rto.pendingFine > 0 ? `₹${v.rto.pendingFine}` : '₹0'}</td>
                                                <td className="p-3">{getStatusIcon(v.compliance.insuranceStatus)}</td>
                                                <td className="p-3">{getStatusIcon(v.compliance.pucStatus)}</td>
                                                <td className="p-3">{getStatusIcon(v.compliance.taxStatus)}</td>
                                                <td className="p-3">{getStatusIcon(v.charging.discrepancyFlag)}</td>
                                                <td className="p-3 text-frog">{v.compliance.overallStatus.length > 0 ? v.compliance.overallStatus[0].split(' on ')[0] : <span className="text-caribbean-green">OK</span>}</td>
                                            </tr>
                                            {expandedRow === v.plate && (
                                                <tr className="bg-pine/30">
                                                    <td colSpan={11} className="p-0">
                                                        <DetailRow vehicle={v} />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={11} className="text-center p-8 text-stone">
                                            {isDateFilterActive
                                                ? "No vehicles found for the selected date range and filters."
                                                : "No vehicles match the current filters."
                                            }
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Charging Discrepancy Summary */}
                {discrepancyData.length > 0 && (
                    <div className="bg-basil/30 backdrop-blur-sm rounded-lg p-4 border border-bangladesh-green animate-slide-in-up" style={{ animationDelay: '200ms'}}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-anti-flash-white">Charging Discrepancy Detections</h2>
                             <div className="flex gap-2">
                                <button
                                    onClick={handleMarkAllReviewed}
                                    disabled={discrepancyData.every(v => reviewedDiscrepancies.has(v.plate))}
                                    className="text-xs px-3 py-1 rounded bg-caribbean-green/20 text-caribbean-green hover:bg-caribbean-green/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Mark All as Reviewed
                                </button>
                                <button
                                    onClick={handleClearReviews}
                                    disabled={reviewedDiscrepancies.size === 0}
                                    className="text-xs px-3 py-1 rounded bg-stone/20 text-stone hover:bg-stone/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Clear Reviews
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="border-b-2 border-bangladesh-green text-stone">
                                    <tr>
                                        {['Plate', 'Billed (kWh)', 'Detected (kWh)', 'Difference', 'Flag'].map(h => (
                                            <th key={h} className="p-3">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {discrepancyData.map((v, i) => (
                                        <tr key={i} className={`border-b border-bangladesh-green/50 hover:bg-frog/30 transition-all ${reviewedDiscrepancies.has(v.plate) ? 'bg-forest/30 opacity-60' : 'bg-frog/20'}`}>
                                            <td className="p-3 font-mono">{v.plate}</td>
                                            <td className="p-3">{v.charging.billed.toFixed(2)}</td>
                                            <td className="p-3">{v.charging.detected.toFixed(2)}</td>
                                            <td className={`p-3 font-bold text-red-400`}>{v.charging.difference.toFixed(2)}</td>
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
                <div className="bg-basil/30 backdrop-blur-sm rounded-lg p-6 border border-bangladesh-green animate-slide-in-up" style={{ animationDelay: '100ms'}}>
                    <h2 className="text-xl font-semibold text-anti-flash-white mb-4 text-center">Overall Compliance Score</h2>
                    <ComplianceGauge score={overallScore} />
                </div>
                <div className="bg-basil/30 backdrop-blur-sm rounded-lg p-6 border border-bangladesh-green animate-slide-in-up" style={{ animationDelay: '300ms'}}>
                    <h2 className="text-xl font-semibold text-anti-flash-white mb-4">Violations Summary</h2>
                    {violations.length > 0 ? (
                        <ul className="space-y-2 max-h-60 overflow-y-auto">
                            {violations.map((violation, i) => (
                                <li key={i} className="flex items-start gap-2 text-frog">
                                    <WarningIcon className="w-5 h-5 mt-1 flex-shrink-0" />
                                    <span>{violation}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center py-4">
                            <CheckCircleIcon className="w-12 h-12 text-caribbean-green mx-auto mb-2" />
                            <p className="text-anti-flash-white">No violations detected.</p>
                        </div>
                    )}
                </div>
                 <div className="bg-basil/30 backdrop-blur-sm rounded-lg p-6 border border-bangladesh-green animate-slide-in-up" style={{ animationDelay: '400ms'}}>
                    <h2 className="text-xl font-semibold text-anti-flash-white mb-4">AI Fleet Recommendations</h2>
                    {isGeneratingSuggestions ? (
                        <div className="flex flex-col items-center justify-center py-4">
                            <ProcessingIcon className="w-12 h-12 text-caribbean-green animate-spin" />
                            <p className="text-stone mt-2">Analyzing fleet data...</p>
                        </div>
                    ) : suggestionsError ? (
                        <p className="text-red-500">{suggestionsError}</p>
                    ) : aiSuggestions ? (
                        <div className="text-sm text-anti-flash-white/90 whitespace-pre-wrap font-mono max-h-80 overflow-y-auto">{aiSuggestions}</div>
                    ) : (
                        <button
                            onClick={handleGenerateSuggestions}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-md font-semibold rounded-md bg-caribbean-green/20 text-caribbean-green hover:bg-caribbean-green/40 disabled:opacity-50 transition-all"
                        >
                            <SparklesIcon className="w-5 h-5" />
                            Generate AI Suggestions
                        </button>
                    )}
                </div>
                <div className="space-y-3">
                    <div className="flex gap-3">
                        <button 
                            onClick={handleReportGeneration} 
                            disabled={isReportButtonDisabled}
                            className="flex-grow text-lg font-bold bg-caribbean-green text-rich-black px-4 py-3 rounded-md hover:bg-mountain-meadow hover:shadow-glow-green-lg transition-all duration-300 disabled:bg-stone disabled:cursor-not-allowed"
                        >
                            {reportButtonText}
                        </button>
                        <button
                            onClick={() => setShowReportOptions(!showReportOptions)}
                            className="flex-shrink-0 p-3 bg-basil rounded-md text-caribbean-green hover:bg-forest hover:shadow-glow-green transition-all"
                            aria-label="Customize Report"
                        >
                            <CogIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {showReportOptions && (
                        <div className="bg-basil/50 p-4 rounded-lg border border-bangladesh-green animate-fade-in text-sm space-y-3">
                             <h4 className="font-semibold text-anti-flash-white mb-2">Report Options</h4>
                             <div className="space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        name="includeComplianceDetails"
                                        checked={reportOptions.includeComplianceDetails} 
                                        onChange={handleReportOptionChange}
                                        className="bg-transparent border-stone rounded focus:ring-caribbean-green text-caribbean-green cursor-pointer" 
                                    />
                                    Compliance Details Table
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        name="includeChargingDiscrepancies"
                                        checked={reportOptions.includeChargingDiscrepancies} 
                                        onChange={handleReportOptionChange}
                                        className="bg-transparent border-stone rounded focus:ring-caribbean-green text-caribbean-green cursor-pointer" 
                                    />
                                    Charging Discrepancy Analysis
                                 </label>
                             </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
    );
};