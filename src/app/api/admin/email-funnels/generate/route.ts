import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { funnelAgent, buildFunnelPrompt, EmailFunnelInput } from '@/lib/ai/funnel-agent';
import { InMemoryRunner } from '@google/adk';

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
    
    const runner = new InMemoryRunner({ agent: funnelAgent });
    const eventStream = runner.runEphemeral({
      userId: 'admin',
      newMessage: { role: 'user', parts: [{ text: prompt }] }
    });

    let outputText = '';
    for await (const event of eventStream) {
      const e = event as any;
      if (e.type === 'content' && e.content?.parts) {
        outputText += e.content.parts.map((p: any) => p.text || '').join('');
      }
    }
    
    // Attempt to parse JSON safely, sometimes LLMs wrap in markdown despite instructions
    let cleanedOutput = outputText.trim();
    if (cleanedOutput.startsWith('```json')) {
      cleanedOutput = cleanedOutput.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanedOutput.startsWith('```')) {
      cleanedOutput = cleanedOutput.replace(/^```/, '').replace(/```$/, '').trim();
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
