import { AiDetection, RtoData, Transaction } from '../types';

export const mockAiDetections: AiDetection[] = [
  {
    "plate": "KA03AB1234",
    "vehicleType": "2-Wheeler",
    "helmet": false,
    "detectedKwh": 12.5,
    "timestamp": "2025-10-31T10:20:00"
  },
  {
    "plate": "TN10CD5678",
    "vehicleType": "4-Wheeler",
    "helmet": null,
    "detectedKwh": 45.0,
    "timestamp": "2025-10-31T10:22:30"
  },
  {
    "plate": "MH12EF9012",
    "vehicleType": "4-Wheeler",
    "helmet": null,
    "detectedKwh": 30.2,
    "timestamp": "2025-11-01T10:25:10"
  },
  {
    "plate": "DL05GH3456",
    "vehicleType": "2-Wheeler",
    "helmet": true,
    "detectedKwh": 14.8,
    "timestamp": "2025-11-01T10:28:05"
  }
];

export const mockRtoDatabase: Record<string, RtoData> = {
  "KA03AB1234": {
    "owner": "Ravi Kumar",
    "vehicleType": "2-Wheeler",
    "registrationValidTill": "2027-03-30",
    "insuranceStatus": "Active",
    "pollutionValidTill": "2026-02-12",
    "pendingFine": 500,
    "fineReason": "No Helmet",
    "roadTaxStatus": "Paid"
  },
  "TN10CD5678": {
    "owner": "Priya Sharma",
    "vehicleType": "4-Wheeler",
    "registrationValidTill": "2029-11-02",
    "insuranceStatus": "Expired",
    "pollutionValidTill": "2025-08-14",
    "pendingFine": 0,
    "fineReason": "None",
    "roadTaxStatus": "Due"
  },
  "MH12EF9012": {
    "owner": "Amit Patel",
    "vehicleType": "4-Wheeler",
    "registrationValidTill": "2023-12-15",
    "insuranceStatus": "Active",
    "pollutionValidTill": "2025-01-20",
    "pendingFine": 1500,
    "fineReason": "Overspeeding",
    "roadTaxStatus": "Paid"
  },
  "DL05GH3456": {
    "owner": "Sunita Devi",
    "vehicleType": "2-Wheeler",
    "registrationValidTill": "2028-06-10",
    "insuranceStatus": "Active",
    "pollutionValidTill": "2024-07-22",
    "pendingFine": 0,
    "fineReason": "None",
    "roadTaxStatus": "Paid"
  }
};

export const parseTransactions = (fileContent: string): Transaction[] => {
  if (!fileContent || !fileContent.trim()) {
    throw new Error("The transaction log file is empty.");
  }
  const lines = fileContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error("The log must contain a header and at least one data row.");
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const transactions: Transaction[] = [];

  const requiredHeaders = ['Timestamp', 'Plate', 'Billed_kWh', 'Amount (₹)', 'Charger_ID'];
  const missingHeaders = requiredHeaders.filter(rh => !headers.includes(rh));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required column(s): ${missingHeaders.join(', ')}.`);
  }


  const keyMap: Record<string, string> = {
    'Timestamp': 'timestamp',
    'Plate': 'plate',
    'Billed_kWh': 'billedKwh',
    'Amount (₹)': 'amount',
    'Charger_ID': 'chargerId'
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue; // Skip empty lines
    const values = line.split(',').map(v => v.trim());
    
    if (values.length !== headers.length) {
        throw new Error(`Row ${i + 1} has an incorrect number of columns. Expected ${headers.length}, but found ${values.length}.`);
    }

    const transaction: any = {};
    headers.forEach((header, index) => {
      const key = keyMap[header] || header.toLowerCase();
      const value = values[index];
      transaction[key] = isNaN(Number(value)) || value === '' ? value : Number(value);
    });
    transactions.push(transaction as Transaction);
  }
  return transactions;
};


export const getMockTransactionCsv = (): string => {
  return `Timestamp,Plate,Billed_kWh,Amount (₹),Charger_ID
2025-10-31T10:20:00,KA03AB1234,15.0,750,EV-CH-01
2025-10-31T10:22:30,TN10CD5678,45.0,2250,EV-CH-01
2025-11-01T10:25:10,MH12EF9012,35.0,1750,EV-CH-02
2025-11-01T10:28:05,DL05GH3456,15.0,755,EV-CH-01
`;
}