import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';

// Parse .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        let key = match[1];
        let value = match[2] || '';
        // Remove quotes if present
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        env[key] = value.trim();
    }
});

const apiKey = env['GEMINI_API_KEY'];
const ai = new GoogleGenAI({
    apiKey: apiKey || 'missing-key',
});

const INTERVIEW_SYSTEM_PROMPT = `
You are having a casual conversation with someone who wants to build something.
You MUST respond in valid JSON with exactly two fields:
{
  "reaction": "emotional phrase",
  "response": "your full message here"
}
`;

async function testSchema(model) {
    console.log(`\nTesting structured output for model: ${model} (NO thinkingConfig)...`);
    try {
        const response = await ai.models.generateContent({
            model: model,
            config: {
                systemInstruction: INTERVIEW_SYSTEM_PROMPT,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        reaction: { type: Type.STRING },
                        response: { type: Type.STRING },
                    },
                    required: ['reaction', 'response'],
                },
                maxOutputTokens: 1024,
            },
            contents: 'Hi Derek, I want to build a SaaS for real estate agents.',
        });
        console.log(`  Success for ${model}!`);
        console.log('  Response:', response.text);
    } catch (err) {
        console.error(`  Error for ${model}:`, err.message || err);
    }
}

async function run() {
    await testSchema('gemini-2.5-pro');
    await testSchema('gemini-2.5-flash');
}

run();
