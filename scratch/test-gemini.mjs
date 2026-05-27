import { GoogleGenAI } from '@google/genai';
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
console.log('Gemini API Key:', apiKey ? 'Loaded (starts with ' + apiKey.substring(0, 8) + ')' : 'Not found');

const ai = new GoogleGenAI({
    apiKey: apiKey || 'missing-key',
});

const modelsToTest = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
];

async function testModel(model) {
    console.log(`\nTesting model: ${model}...`);
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: 'Hello! This is a test message.',
        });
        console.log(`  Success for ${model}!`);
        console.log('  Response preview:', response.text?.trim().substring(0, 100));
        return true;
    } catch (err) {
        console.error(`  Error for ${model}:`, err.message || err);
        return false;
    }
}

async function run() {
    for (const model of modelsToTest) {
        await testModel(model);
    }
}

run();
