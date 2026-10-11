import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const FILTER_PATTERNS: RegExp[] = [
  // Phone patterns
  /(\+?251[-. ]?)(9\d[-. ]?\d{3}[-. ]?\d{4})/gi,
  /(0[97]\d[-. ]?\d{3}[-. ]?\d{4})/gi,
  /\b(zero|sifir)[-\s]?(nine|tisit|tis'et)[-\s]?(\d[-\s]?){6,}\b/gi,
  /[\u1369-\u1371][\u1369-\u1371\s]{5,12}[\u1369-\u1371]/g,
  /\b\d[\d\s\-.]{7,14}\d\b/g,
  /(whatsapp|telegram|viber|imo|wechat)[\s:]*[+\d\s\-.]{7,}/gi,
  /(ደውሉ|ቁጥሬ|ቁጥሩ|ቁጥሯ)[\s:]*[\d\s\-+]{5,}/gi,
  // Social media patterns
  /t\.me\/\w+/gi,
  /facebook\.com\/\w+/gi,
  /instagram\.com\/\w+/gi,
  /twitter\.com\/\w+/gi,
  /x\.com\/\w+/gi,
  /tiktok\.com\/\@?\w+/gi,
  /@\w+/gi, // generic mentions
];

export function containsContactInfo(text: string): boolean {
  return FILTER_PATTERNS.some(p => { p.lastIndex = 0; return p.test(text); });
}

export function maskContactInfo(text: string): string {
  let result = text;
  FILTER_PATTERNS.forEach(p => {
    p.lastIndex = 0;
    result = result.replace(p, '[*** *** ***]');
  });
  return result;
}

export async function filterMessage(text: string, userId: string, violationCount: number): Promise<{
  isClean: boolean;
  filteredText: string;
  originalText: string;
  violationType: string | null;
  shouldWarn: boolean;
  shouldBan: boolean;
}> {
  const isRegexViolation = containsContactInfo(text);
  let isAiViolation = false;

  if (!isRegexViolation && text.length > 8) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: text,
        config: {
          systemInstruction: 'Detect if message tries to share a phone number, contact info, or social media links/handles (Facebook, Telegram, TikTok, Instagram, WhatsApp, X/Twitter, etc) to bypass platform. Reply JSON: {"hasContactInfo":boolean,"confidence":number}',
          responseMimeType: 'application/json',
        }
      });
      const r = JSON.parse(response.text || '{}');
      isAiViolation = r.hasContactInfo && r.confidence > 0.8;
    } catch (_) { /* fallback to regex only */ }
  }

  const isViolation = isRegexViolation || isAiViolation;
  return {
    isClean: !isViolation,
    filteredText: isViolation ? maskContactInfo(text) : text,
    originalText: text,
    violationType: isViolation ? (isRegexViolation ? 'contact_regex' : 'contact_ai') : null,
    shouldWarn: isViolation && violationCount === 0,
    shouldBan: isViolation && violationCount >= 2,
  };
}
