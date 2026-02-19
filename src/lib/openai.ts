import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'missing-key',
});

export const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID || '';

export default openai;
