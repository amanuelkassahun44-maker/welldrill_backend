import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ModerationResult {
  decision: 'approved' | 'rejected';
  confidence: number;
  rejectionReason?: string;
  categories: Record<string, boolean>;
}

export async function moderatePost(params: {
  imageBase64?: string;
  caption: string;
  mediaType: 'image' | 'video';
}): Promise<ModerationResult> {
  const systemInstruction = `You are a strict content moderator for WellDrill Ethiopia — a professional water well drilling marketplace. 
APPROVE ONLY: drilling rigs, water wells, boreholes, pumps, drill pipes, hydrogeology, water gushing, machinery.
REJECT: politics, entertainment, music, sports, spam, memes, adult content, anything unrelated to drilling/water.
Reply JSON: {"decision":"approved"|"rejected","confidence":0-1,"isDrilling":bool,"isPolitical":bool,"isSpam":bool,"rejectionReason":string|null}`;

  const parts: any[] = [];
  if (params.imageBase64) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: params.imageBase64
      }
    });
  }
  parts.push({
    text: `Caption: "${params.caption}". Media type: ${params.mediaType}.`
  });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: parts,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
    }
  });

  const raw = JSON.parse(response.text || '{}');
  return {
    decision: raw.decision || 'rejected',
    confidence: raw.confidence || 0,
    rejectionReason: raw.rejectionReason,
    categories: { isDrilling: raw.isDrilling, isPolitical: raw.isPolitical, isSpam: raw.isSpam },
  };
}
