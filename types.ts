
export interface Transaction {
  timestamp: string;
  plate: string;
  billedKwh: number;
  amount: number;
  chargerId: string;
}

export interface AiDetection {
  plate: string;
  vehicleType: '2-Wheeler' | '4-Wheeler' | 'Truck' | 'Other';
  helmet: boolean | null;
  detectedKwh: number;
  timestamp: string;
}

export interface RtoData {
  owner: string;
  vehicleType: string;
  registrationValidTill: string;
  insuranceStatus: 'Active' | 'Expired';
  pollutionValidTill: string;
  pendingFine: number;
  fineReason: string;
  roadTaxStatus: 'Paid' | 'Due';
}

export interface ProcessedVehicleData {
  plate: string;
  vehicleType: '2-Wheeler' | '4-Wheeler' | 'Truck' | 'Other';
  helmet: boolean | null;
  rto: RtoData;
  charging: {
    billed: number;
    detected: number;
    difference: number;
    discrepancyFlag: 'OK' | 'Suspicious' | 'Potential Charger Fault';
  };
  compliance: {
    score: number;
    fineStatus: string;
    insuranceStatus: 'Active' | 'Expired';
    pucStatus: 'Valid' | 'Expired';
    taxStatus: 'Paid' | 'Due';
    registrationStatus: 'Valid' | 'Expired';
    overallStatus: string[];
  };
}

export interface ReportSections {
  includeComplianceDetails: boolean;
  includeChargingDiscrepancies: boolean;
}
