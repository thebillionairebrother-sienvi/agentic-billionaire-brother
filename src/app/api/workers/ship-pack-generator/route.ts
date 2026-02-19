import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import openai, { ASSISTANT_ID } from '@/lib/openai';

/**
 * Extracts a JSON object from text that may contain conversational wrapping.
 */
function extractJSON(text: string): Record<string, unknown> {
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    if (cleaned.startsWith('{')) return JSON.parse(cleaned);
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error(`No JSON found in response: "${cleaned.substring(0, 80)}..."`);
    }
    return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
}

interface WorkerPayload {
    jobId: string;
    cycleId: string;
    userId: string;
    decisionId: string;
}

export async function POST(request: Request) {
    const { jobId, cycleId, userId, decisionId }: WorkerPayload = await request.json();
    const supabase = await createServiceClient();

    try {
        // Mark job processing
        await supabase
            .from('generation_jobs')
            .update({ status: 'processing', started_at: new Date().toISOString(), attempts: 1 })
            .eq('id', jobId);

        // Fetch context
        const { data: decision } = await supabase
            .from('decisions')
            .select('thread_id, chosen_strategy_id')
            .eq('id', decisionId)
            .single();

        const { data: strategy } = await supabase
            .from('strategy_options')
            .select('*')
            .eq('id', decision!.chosen_strategy_id)
            .single();

        const { data: contract } = await supabase
            .from('execution_contracts')
            .select('*')
            .eq('user_id', userId)
            .order('signed_at', { ascending: false })
            .limit(1)
            .single();

        const { data: businessProfile } = await supabase
            .from('business_profiles')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // Use existing thread or create new one
        const threadId = decision!.thread_id;

        const shipPackPrompt = `
You are a JSON-only API. Do NOT include any conversational text, greetings, or explanations outside the JSON.

TASK: Generate Week 1 Ship Pack

LOCKED STRATEGY: ${strategy!.archetype}
THESIS: ${strategy!.thesis}
LOCKED KPI: ${contract!.locked_kpi}
WEEKLY DELIVERABLE: ${contract!.weekly_deliverable}
CALENDAR BLOCKS: ${contract!.calendar_blocks}
HOURS/WEEK: ${businessProfile?.hours_per_week || 10}
TEAM: ${businessProfile?.team_size || 'solo'}

Generate a ship pack with exactly:
- 2 big deliverables (substantial assets from departments)
- 5 small tasks (quick wins, setup tasks)

Each deliverable must have a department assignment from: competitive_intel, copy_conversion, seo_demand, business_plan, content_distribution

Total estimated time must NOT exceed the founder's hours/week budget.

OUTPUT FORMAT: Return ONLY the raw JSON object below. No markdown, no code fences, no introduction, no explanation — just the JSON:
{
  "week_number": 1,
  "kpi_target": "string - specific target for this week",
  "big_deliverables": [
    {
      "title": "string",
      "department": "competitive_intel|copy_conversion|seo_demand|business_plan|content_distribution",
      "description": "string",
      "estimated_hours": 2
    }
  ],
  "small_tasks": [
    {
      "title": "string",
      "description": "string",
      "assignee": "founder|va1|va2",
      "time_mins": 30,
      "day": 1
    }
  ],
  "total_estimated_hours": 8,
  "assumptions": [
    {"text": "string", "category": "market|resource|timing", "risk_level": "low|medium|high"}
  ]
}`;

        if (threadId) {
            await openai.beta.threads.messages.create(threadId, {
                role: 'user',
                content: shipPackPrompt,
            });
        }

        const activeThreadId = threadId || (await openai.beta.threads.create()).id;

        if (!threadId) {
            await openai.beta.threads.messages.create(activeThreadId, {
                role: 'user',
                content: shipPackPrompt,
            });
        }

        let run = await openai.beta.threads.runs.create(activeThreadId, {
            assistant_id: ASSISTANT_ID,
        });

        // Poll
        const timeout = Date.now() + 120_000;
        while (run.status === 'in_progress' || run.status === 'queued') {
            if (Date.now() > timeout) throw new Error('Ship pack generation timed out');
            await new Promise((r) => setTimeout(r, 2000));
            run = await openai.beta.threads.runs.retrieve(run.id, { thread_id: activeThreadId });
        }

        if (run.status !== 'completed') {
            throw new Error(`Run failed: ${run.status}`);
        }

        // Parse response
        const messages = await openai.beta.threads.messages.list(activeThreadId, {
            order: 'desc',
            limit: 1,
        });

        const textContent = messages.data[0]?.content.find((c) => c.type === 'text');
        if (!textContent || textContent.type !== 'text') throw new Error('No response');

        const rawText = textContent.text.value;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsed = extractJSON(rawText) as any;

        // Update cycle
        await supabase
            .from('weekly_cycles')
            .update({
                status: 'active',
                kpi_target: parsed.kpi_target,
                thread_id: activeThreadId,
            })
            .eq('id', cycleId);

        // Insert big deliverables
        for (const deliverable of parsed.big_deliverables) {
            await supabase.from('deliverables').insert({
                weekly_cycle_id: cycleId,
                user_id: userId,
                department: deliverable.department,
                title: deliverable.title,
                size: 'big',
                status: 'ready',
                content: deliverable,
            });
        }

        // Insert small tasks as deliverables + tasks
        for (const task of parsed.small_tasks) {
            await supabase.from('tasks').insert({
                weekly_cycle_id: cycleId,
                user_id: userId,
                title: task.title,
                description: task.description,
                assignee: task.assignee,
                status: 'todo',
                sort_order: task.day,
            });
        }

        // Mark job completed
        await supabase
            .from('generation_jobs')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', jobId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Ship pack worker error:', error);
        await supabase
            .from('generation_jobs')
            .update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Unknown error' })
            .eq('id', jobId);

        return NextResponse.json({ error: 'Ship pack generation failed' }, { status: 500 });
    }
}
