import React, { useState, useRef } from 'react';
import { UploadIcon, CameraIcon, BoltIcon } from './Icons';
import { getMockTransactionCsv } from '../services/mockData';

interface UploadViewProps {
  onAnalyze: (videoFile: File, transactionLog: string) => void;
  isLoading: boolean;
  parsingError: string | null;
  onClearParsingError: () => void;
}

export const UploadView: React.FC<UploadViewProps> = ({ onAnalyze, isLoading, parsingError, onClearParsingError }) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [transactionLog, setTransactionLog] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');

  const videoInputRef = useRef<HTMLInputElement>(null);
  const transactionInputRef = useRef<HTMLInputElement>(null);

  const clearAllErrors = () => {
    setValidationError('');
    if (parsingError) {
      onClearParsingError();
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
      clearAllErrors();
    }
  };

  const handleTransactionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setTransactionLog(event.target?.result as string);
        clearAllErrors();
      };
      reader.readAsText(e.target.files[0]);
    }
  };
  
  const handleUseMockData = () => {
    const mockCsv = getMockTransactionCsv();
    const mockVideoFile = new File(["mock video content"], "cctv_feed.mp4", { type: "video/mp4" });
    setTransactionLog(mockCsv);
    setVideoFile(mockVideoFile);
    clearAllErrors();
  }

  const handleAnalyzeClick = () => {
    if (!videoFile || !transactionLog) {
      setValidationError('Please provide both a CCTV feed and a transaction log.');
      return;
    }
    clearAllErrors();
    onAnalyze(videoFile, transactionLog);
  };

  const displayError = parsingError || validationError;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-4xl text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-caribbean-green mb-4 tracking-wider inline-block pb-2 border-b-2 border-caribbean-green/30 shadow-glow-green">AI VEHICLE COMPLIANCE DASHBOARD</h1>
        <p className="text-lg text-anti-flash-white/80 mb-10">Futuristic Analysis of CCTV Feeds & RTO Data</p>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Video Upload */}
          <div 
            onClick={() => videoInputRef.current?.click()} 
            className="bg-pine/50 border-2 border-dashed border-bangladesh-green rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:border-caribbean-green hover:bg-basil transition-all duration-300 transform hover:-translate-y-1 hover:animate-border-glow-pulse"
          >
            <CameraIcon className="w-16 h-16 text-caribbean-green mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-anti-flash-white">Upload CCTV Feed</h2>
            <p className="text-stone">{videoFile ? videoFile.name : 'Click to select .mp4 file'}</p>
            <input type="file" ref={videoInputRef} onChange={handleVideoChange} accept="video/mp4" className="hidden" />
          </div>

          {/* Transaction Log Upload */}
          <div 
            onClick={() => transactionInputRef.current?.click()}
            className="bg-pine/50 border-2 border-dashed border-bangladesh-green rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:border-caribbean-green hover:bg-basil transition-all duration-300 transform hover:-translate-y-1 hover:animate-border-glow-pulse"
          >
            <BoltIcon className="w-16 h-16 text-caribbean-green mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-anti-flash-white">Upload Transaction Log</h2>
            <p className="text-stone">{transactionLog ? 'Log file loaded' : 'Click to select .csv or .json'}</p>
            <input type="file" ref={transactionInputRef} onChange={handleTransactionChange} accept=".csv,.json" className="hidden" />
          </div>
        </div>

        {displayError && <p className="text-red-500 mb-4 font-semibold">{displayError}</p>}
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleAnalyzeClick}
              disabled={isLoading || !videoFile || !transactionLog}
              className="w-full sm:w-auto text-lg font-bold bg-caribbean-green text-rich-black px-12 py-4 rounded-md hover:bg-mountain-meadow hover:shadow-glow-green-lg transition-all duration-300 disabled:bg-stone disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              <UploadIcon className="w-6 h-6" />
              {isLoading ? 'ANALYZING...' : 'START ANALYSIS'}
            </button>
            <button
                onClick={handleUseMockData}
                disabled={isLoading}
                className="w-full sm:w-auto text-lg font-bold bg-transparent border-2 border-frog text-frog px-12 py-4 rounded-md hover:bg-frog hover:text-rich-black transition-all duration-300 disabled:opacity-50"
            >
                Use Mock Data
            </button>
        </div>

      </div>
    </div>
  );
};