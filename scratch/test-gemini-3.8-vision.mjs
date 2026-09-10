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
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        env[key] = value.trim();
    }
});

const apiKey = env['GEMINI_API_KEY'];
const model = env['GEMINI_EXTENSION_MODEL'] || 'gemini-3.8-flash';

console.log(`[TEST] Initializing GoogleGenAI with model: ${model}...`);
const ai = new GoogleGenAI({ apiKey });

// 1x1 transparent GIF / PNG base64 for testing multimodal input payload
const testPixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function testVisionAndAudit() {
    console.log(`[TEST] Sending multimodal prompt with inlineData image to ${model}...`);
    for (let attempt = 1; attempt <= 4; attempt++) {
        try {
            console.log(`[TEST] Attempt ${attempt}...`);
            const response = await ai.models.generateContent({
                model: model,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: 'Analyze this webpage screenshot. Mention what it sells and what season this might be.' },
                            {
                                inlineData: {
                                    mimeType: 'image/png',
                                    data: testPixelBase64,
                                }
                            }
                        ]
                    }
                ],
                config: {
                    systemInstruction: 'You are Derek, a ruthless business mentor. Provide concise blunt feedback in JSON.',
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            whatThisPageSells: { type: Type.STRING },
                            whoItIsFor: { type: Type.STRING },
                            reaction: { type: Type.STRING },
                        },
                        required: ['whatThisPageSells', 'whoItIsFor', 'reaction']
                    }
                }
            });

            console.log('[TEST] SUCCESS! Multimodal response received from', model);
            console.log('[TEST] Output:', response.text);
            return;
        } catch (err) {
            console.warn(`[TEST] Attempt ${attempt} error:`, err?.status || err?.message);
            await new Promise(r => setTimeout(r, 1500));
        }
    }
}

testVisionAndAudit();
