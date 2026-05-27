import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || 'missing-key',
});

// Intercept generateContent calls to strip thinkingConfig for gemini-2.5 models
const originalGenerateContent = ai.models.generateContent.bind(ai.models);
ai.models.generateContent = async function (args) {
    if (args && args.config && 'thinkingConfig' in args.config) {
        const { thinkingConfig, ...restConfig } = args.config;
        args.config = restConfig;
    }
    return originalGenerateContent(args);
};

export const GEMINI_MODEL = 'gemini-2.5-pro';

export default ai;
