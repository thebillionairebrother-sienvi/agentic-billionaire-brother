import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { buildFunnelPrompt, EmailFunnelInput, generateContentConfig } from '@/lib/ai/funnel-agent';
import { GoogleGenAI } from '@google/genai';

const SYSTEM_INSTRUCTION = `
You are an admin-only email funnel copy agent for a Next.js marketing platform.

Your only job is to generate a 5-email marketing funnel as strict JSON.
You do not explain your reasoning.
You do not return markdown.
You do not return code fences.
You do not return commentary before or after the JSON.

Return exactly one JSON object matching this schema:
{
  "emails": [
    {
      "sequence_order": <integer 1-5>,
      "subject": "<compelling subject line>",
      "content": "<email-safe HTML fragment>"
    }
  ]
}

Return exactly 5 emails with sequence_order 1 through 5.
Each content field must be an email-safe HTML fragment using only: <p>, <strong>, <em>, <ul>, <li>, <br>, <h2>, <h3>, <a>, and limited inline <span style="color: ...">.
Do NOT include <html>, <body>, <script>, <style>, <form>, or <iframe> tags.
Each email must have one clear CTA.
Return ONLY the JSON object — no markdown, no code fences, no explanation.
`;

export async function POST(request: Request) {
  try {
    // 1. Verify admin access
    await requireAdmin();

    // 2. Parse request
    const body = await request.json() as EmailFunnelInput;
    if (!body.purpose || !body.ageGroup) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 3. Generate content via Gemini SDK directly
    const prompt = buildFunnelPrompt(body);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelName = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        ...generateContentConfig,
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    const outputText = response.text ?? '';
    console.log('Gemini raw output length:', outputText.length);

    if (!outputText.trim()) {
      console.error('Gemini returned empty output');
      return NextResponse.json({ error: 'AI returned empty response. Please try again.' }, { status: 500 });
    }

    // 4. Parse JSON — handle various wrapping formats
    let cleanedOutput = outputText.trim();
    let parsedJson;

    // Strip markdown code blocks if present
    const jsonMatch = cleanedOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      cleanedOutput = jsonMatch[1].trim();
    } else {
      // Find the first '{' and last '}' to extract raw JSON
      const firstBrace = cleanedOutput.indexOf('{');
      const lastBrace = cleanedOutput.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        cleanedOutput = cleanedOutput.slice(firstBrace, lastBrace + 1);
      }
    }

    try {
      parsedJson = JSON.parse(cleanedOutput);
    } catch (parseError) {
      console.error('Failed to parse Gemini output:', outputText.slice(0, 500));
      return NextResponse.json({ error: 'Agent returned invalid JSON structure.' }, { status: 500 });
    }

    // 5. Validate the structure has emails array
    if (!parsedJson.emails || !Array.isArray(parsedJson.emails)) {
      console.error('Parsed JSON missing emails array:', JSON.stringify(parsedJson).slice(0, 300));
      return NextResponse.json({ error: 'AI output missing emails array.' }, { status: 500 });
    }

    // 6. Return successful funnel data
    return NextResponse.json({ success: true, data: parsedJson });
  } catch (error: any) {
    console.error('Funnel generation error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
