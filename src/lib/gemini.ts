import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || 'missing-key',
});

export const GEMINI_MODEL = 'gemini-2.0-flash';

export default ai;
