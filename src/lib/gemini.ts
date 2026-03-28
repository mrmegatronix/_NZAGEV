import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ScanResult {
  documentType: 'NZ Driver Licence' | 'NZ Passport' | 'Kiwi Access Card' | 'Unknown';
  dob: string; // YYYY-MM-DD
  initials: string;
  gender: 'Male' | 'Female' | 'Other' | 'Unknown';
}

export async function analyzeIdImage(base64Image: string): Promise<ScanResult> {
  const mimeType = base64Image.match(/data:(.*?);base64,/)?.[1] || 'image/jpeg';
  const base64Data = base64Image.replace(/^data:image\/(png|jpeg|webp);base64,/, '');

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-preview',
    contents: [
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
      {
        text: `Analyze this image of an ID card (NZ Driver Licence, NZ Passport, or Kiwi Access Card).
        Extract the following information:
        1. Document Type: Identify if it's a 'NZ Driver Licence', 'NZ Passport', 'Kiwi Access Card', or 'Unknown'.
        2. Date of Birth (dob): Extract the date of birth in YYYY-MM-DD format.
        3. Initials: Extract the first letter of the first name and the first letter of the last name (e.g., 'JD' for John Doe).
        4. Gender: Extract the gender if visible ('Male', 'Female', 'Other', or 'Unknown').

        Return the data strictly in JSON format matching the schema. Do not include any PII other than initials and DOB.`,
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          documentType: {
            type: Type.STRING,
            description: "The type of document",
            enum: ['NZ Driver Licence', 'NZ Passport', 'Kiwi Access Card', 'Unknown']
          },
          dob: {
            type: Type.STRING,
            description: "Date of birth in YYYY-MM-DD format"
          },
          initials: {
            type: Type.STRING,
            description: "First and last name initials, e.g., 'JD'"
          },
          gender: {
            type: Type.STRING,
            description: "Gender of the person",
            enum: ['Male', 'Female', 'Other', 'Unknown']
          }
        },
        required: ['documentType', 'dob', 'initials', 'gender']
      }
    }
  });

  const jsonStr = response.text?.trim() || '{}';
  try {
    return JSON.parse(jsonStr) as ScanResult;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("Failed to parse ID data");
  }
}
