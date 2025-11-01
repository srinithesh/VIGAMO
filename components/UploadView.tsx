import React, { useState, useRef } from 'react';
import { UploadIcon, CameraIcon, BoltIcon } from './Icons';
import { getMockTransactionCsv } from '../services/mockData';

interface UploadViewProps {
  onAnalyze: (videoFile: File, transactionLog: string) => void;
  isLoading: boolean;
}

export const UploadView: React.FC<UploadViewProps> = ({ onAnalyze, isLoading }) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [transactionLog, setTransactionLog] = useState<string>('');
  const [error, setError] = useState<string>('');

  const videoInputRef = useRef<HTMLInputElement>(null);
  const transactionInputRef = useRef<HTMLInputElement>(null);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
    }
  };

  const handleTransactionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setTransactionLog(event.target?.result as string);
      };
      reader.readAsText(e.target.files[0]);
    }
  };
  
  const handleUseMockData = () => {
    const mockCsv = getMockTransactionCsv();
    const mockVideoFile = new File(["mock video content"], "charging_bay_feed.mp4", { type: "video/mp4" });
    setTransactionLog(mockCsv);
    setVideoFile(mockVideoFile);
    setError('');
  }

  const handleAnalyzeClick = () => {
    if (!videoFile || !transactionLog) {
      setError('Please upload both charging bay footage and a charging log.');
      return;
    }
    setError('');
    onAnalyze(videoFile, transactionLog);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-4xl text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-ev-orange mb-4 tracking-wider inline-block pb-2 border-b-2 border-ev-orange/50 shadow-glow-orange">AI EV FLEET COMPLIANCE HUB</h1>
        <p className="text-lg text-ev-light-gray mb-10">Smart Charging Verification, RTO Compliance & Fleet Analysis</p>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Video Upload */}
          <div 
            onClick={() => videoInputRef.current?.click()} 
            className="bg-ev-panel-blue/50 border-2 border-dashed border-ev-border-blue rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:border-ev-orange hover:bg-ev-panel-blue transition-all duration-300 transform hover:-translate-y-1 hover:animate-border-glow-pulse"
          >
            <CameraIcon className="w-16 h-16 text-ev-orange mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-ev-light-gray">Upload Charging Bay Footage</h2>
            <p className="text-ev-text-slate">{videoFile ? videoFile.name : 'Click to select .mp4 file'}</p>
            <input type="file" ref={videoInputRef} onChange={handleVideoChange} accept="video/mp4" className="hidden" />
          </div>

          {/* Transaction Log Upload */}
          <div 
            onClick={() => transactionInputRef.current?.click()}
            className="bg-ev-panel-blue/50 border-2 border-dashed border-ev-border-blue rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:border-ev-orange hover:bg-ev-panel-blue transition-all duration-300 transform hover:-translate-y-1 hover:animate-border-glow-pulse"
          >
            <BoltIcon className="w-16 h-16 text-ev-orange mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-ev-light-gray">Upload Charging Log</h2>
            <p className="text-ev-text-slate">{transactionLog ? 'Log file loaded' : 'Click to select .csv or .json'}</p>
            <input type="file" ref={transactionInputRef} onChange={handleTransactionChange} accept=".csv,.json" className="hidden" />
          </div>
        </div>

        {error && <p className="text-ev-pink mb-4">{error}</p>}
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleAnalyzeClick}
              disabled={isLoading || !videoFile || !transactionLog}
              className="w-full sm:w-auto text-lg font-bold bg-ev-orange text-ev-dark-blue px-12 py-4 rounded-md hover:bg-ev-light-pink hover:shadow-glow-orange-lg transition-all duration-300 disabled:bg-ev-text-slate disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              <UploadIcon className="w-6 h-6" />
              {isLoading ? 'ANALYZING...' : 'START ANALYSIS'}
            </button>
            <button
                onClick={handleUseMockData}
                disabled={isLoading}
                className="w-full sm:w-auto text-lg font-bold bg-transparent border-2 border-ev-pink text-ev-pink px-12 py-4 rounded-md hover:bg-ev-pink hover:text-ev-dark-blue transition-all duration-300 disabled:opacity-50"
            >
                Use Mock Data
            </button>
        </div>

      </div>
    </div>
  );
};