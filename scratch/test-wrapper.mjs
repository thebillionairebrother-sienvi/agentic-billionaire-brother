import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
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

// Wrap generateContent to strip thinkingConfig if present
const originalGenerateContent = ai.models.generateContent.bind(ai.models);
ai.models.generateContent = async function (args) {
    console.log('Intercepted generateContent!');
    if (args && args.config && 'thinkingConfig' in args.config) {
        console.log('Stripping thinkingConfig...');
        const { thinkingConfig, ...restConfig } = args.config;
        args.config = restConfig;
    }
    return originalGenerateContent(args);
};

async function run() {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            config: {
                maxOutputTokens: 1024,
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
            contents: 'Hi there, say hello.',
        });
        console.log('Success!', response.text);
    } catch (err) {
        console.error('Error:', err.message || err);
    }
}

run();
