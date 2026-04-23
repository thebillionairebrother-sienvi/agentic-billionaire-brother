import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { funnelAgent, buildFunnelPrompt, generateContentConfig, EmailFunnelInput } from '@/lib/ai/funnel-agent';

export async function POST(request: Request) {
  try {
    // 1. Verify admin access
    await requireAdmin();

    // 2. Parse request
    const body = await request.json() as EmailFunnelInput;
    if (!body.purpose || !body.ageGroup) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 3. Generate content via Gemini ADK
    const prompt = buildFunnelPrompt(body);
    const response = await funnelAgent.generate({
      prompt,
      config: generateContentConfig
    });

    const outputText = response.text || '';
    
    // Attempt to parse JSON safely, sometimes LLMs wrap in markdown despite instructions
    let cleanedOutput = outputText.trim();
    if (cleanedOutput.startsWith('\`\`\`json')) {
      cleanedOutput = cleanedOutput.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
    } else if (cleanedOutput.startsWith('\`\`\`')) {
      cleanedOutput = cleanedOutput.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim();
    }

    let parsedJson;
    try {
      parsedJson = JSON.parse(cleanedOutput);
    } catch (parseError) {
      console.error('Failed to parse Gemini output:', cleanedOutput);
      return NextResponse.json({ error: 'Agent returned invalid JSON structure.' }, { status: 500 });
    }

    // 4. Return successful funnel data
    return NextResponse.json({ success: true, data: parsedJson });
  } catch (error: any) {
    console.error('Funnel generation error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
