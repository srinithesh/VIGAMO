
import { ProcessedVehicleData } from '../types';

export async function getComplianceSummary(vehicleData: ProcessedVehicleData): Promise<string> {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const model = 'gemini-2.5-flash';
    const { rto, compliance, charging, helmet, vehicleType } = vehicleData;

    // Create a simplified object for the prompt
    const promptData = {
        plate: vehicleData.plate,
        vehicleType,
        helmet: helmet === null ? 'N/A' : helmet ? 'Worn' : 'Not Worn',
        complianceIssues: compliance.overallStatus,
        rtoDetails: {
            registration: compliance.registrationStatus,
            insurance: compliance.insuranceStatus,
            puc: compliance.pucStatus,
            tax: compliance.taxStatus,
            fine: rto.pendingFine > 0 ? `₹${rto.pendingFine} for ${rto.fineReason}` : 'None',
        },
        chargingCheck: {
            status: charging.discrepancyFlag,
            discrepancy: charging.difference.toFixed(2) + ' kWh'
        }
    };

    const prompt = `
        You are an AI Vehicle Compliance Specialist for a futuristic transit network.
        Your task is to analyze the provided vehicle data and generate a concise, human-readable compliance summary, following strict NASA-style brevity.

        Rules:
        - Start with the vehicle's designation (plate number).
        - Use bullet points for clarity.
        - Report ONLY on anomalies, violations, or warnings.
        - If there are no issues, the only acceptable response is "All systems nominal. Full compliance achieved."
        - Keep the summary brief and technical.

        Here is the data for the vehicle:
        ${JSON.stringify(promptData, null, 2)}

        Generate the compliance summary now.
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to generate AI summary.");
    }
}


export async function getOverallSuggestions(data: ProcessedVehicleData[]): Promise<string> {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const model = 'gemini-2.5-flash';

    const totalVehicles = data.length;
    const overallScore = data.reduce((acc, v) => acc + v.compliance.score, 0) / (totalVehicles || 1);
    
    const violationCounts = data.flatMap(v => v.compliance.overallStatus).reduce((acc, status) => {
        const key = status.split(' on ')[0].split(' for ')[0];
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const summary = {
        totalVehicles,
        averageComplianceScore: overallScore.toFixed(2),
        violationSummary: violationCounts,
        chargingDiscrepancies: data.filter(v => v.charging.discrepancyFlag !== 'OK').length,
    };

    const prompt = `
        You are a seasoned Fleet Compliance Manager AI, tasked with providing strategic advice to improve a vehicle fleet's operational standards.
        Based on the following compliance data summary, generate a set of actionable recommendations.

        Rules:
        - Provide a brief, high-level overview of the fleet's current status.
        - Structure your recommendations under three distinct headings: "Immediate Actions", "Policy Recommendations", and "Potential Risks".
        - Use bullet points for each recommendation.
        - Ensure the tone is professional, authoritative, and helpful.

        Fleet Compliance Data:
        ${JSON.stringify(summary, null, 2)}

        Generate your strategic recommendations now.
    `;
    
     try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error calling Gemini API for suggestions:", error);
        throw new Error("Failed to generate AI suggestions.");
    }
}