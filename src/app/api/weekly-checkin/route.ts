import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import openai, { ASSISTANT_ID } from '@/lib/openai';

function parseDerekResponse(raw: string): { reaction: string; response: string } {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try {
        const parsed = JSON.parse(cleaned);
        if (parsed.reaction && parsed.response) return parsed;
    } catch { /* fallback */ }

    const reactionMatch = raw.match(/"reaction"\s*:\s*"([^"]+)"/);
    const responseMatch = raw.match(/"response"\s*:\s*"([\s\S]*?)"\s*\}?\s*$/);
    return {
        reaction: reactionMatch?.[1] || '',
        response: responseMatch?.[1]?.replace(/\\n/g, '\n') || raw,
    };
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { message, threadId } = await request.json();

        // Gather weekly context
        const { data: contract } = await supabase
            .from('execution_contracts')
            .select('*, strategy:strategy_options(*)')
            .eq('user_id', user.id)
            .order('signed_at', { ascending: false })
            .limit(1)
            .single();

        const { data: currentCycle } = await supabase
            .from('weekly_cycles')
            .select('*')
            .eq('user_id', user.id)
            .order('week_number', { ascending: false })
            .limit(1)
            .single();

        // Get week's tasks
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const { data: weekTasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .gte('due_date', weekAgo.toISOString().split('T')[0])
            .lte('due_date', today.toISOString().split('T')[0])
            .order('due_date', { ascending: true });

        const tasks = weekTasks || [];
        const doneTasks = tasks.filter(t => t.status === 'done');
        const skippedTasks = tasks.filter(t => t.status === 'skipped');
        const pendingTasks = tasks.filter(t => t.status === 'todo' || t.status === 'in_progress');

        const taskSummary = tasks.map(t =>
            `- ${t.title} [${t.status}] (due: ${t.due_date})`
        ).join('\n');

        const systemContext = `You are Derek, the Billionaire Brother — conducting a WEEKLY CHECK-IN interview.

CONTEXT:
- Strategy: ${contract?.strategy?.archetype || 'Not set'}
- Thesis: ${contract?.strategy?.thesis || ''}
- Week: ${currentCycle?.week_number || 1}
- KPI Target: ${currentCycle?.kpi_target || 'Not set'}
- Tasks this week: ${tasks.length} total, ${doneTasks.length} completed, ${skippedTasks.length} skipped, ${pendingTasks.length} pending

TASK BREAKDOWN:
${taskSummary || 'No tasks recorded this week'}

YOUR ROLE:
You are interviewing the user about their week. This is a structured check-in, NOT a free-form chat.
Follow this interview flow (one topic per message, don't rush):

1. FIRST MESSAGE: Greet them warmly, mention it's Week ${currentCycle?.week_number || 1} check-in. Ask about their KPI results (${currentCycle?.kpi_target || 'their target'}). Be specific — ask for numbers.
2. After KPI: React to their KPI numbers, then ask which tasks had the MOST impact and why.
3. After impact: Ask if any tasks felt too hard, pointless, or not aligned with their strategy.
4. After feedback: Ask what they want to KILL (stop doing), KEEP (continue), or DOUBLE DOWN on next week.
5. After Kill/Keep/Double: Ask for their ONE biggest insight/lesson from this week.
6. FINAL MESSAGE: When you have enough info (5+ exchanges), end with an encouraging sign-off AND include this exact marker on its own line: %%CHECKIN_COMPLETE%%

RULES:
- Ask ONE question at a time. Don't pile up multiple questions.
- Reference their specific tasks by name when relevant.
- Be direct and conversational — not corporate.
- Keep responses 2-3 sentences max (plus your question).
- Celebrate their wins genuinely. Challenge them on skipped tasks.
- If they dodge a question, gently redirect.

RESPONSE FORMAT:
Always respond in this exact JSON format:
{
  "reaction": "emotional phrase",
  "response": "your actual message here"
}

REACTION RULES:
- "reaction" is a 2-3 word emotional phrase for GIF selection
- Examples: "let's go", "tell me more", "proud of you", "hmm interesting", "respect the grind"
- Always include a reaction, never leave it empty`;

        // Create or reuse thread
        let activeThreadId = threadId;
        if (!activeThreadId) {
            const thread = await openai.beta.threads.create();
            activeThreadId = thread.id;

            // Send system context as first message
            await openai.beta.threads.messages.create(activeThreadId, {
                role: 'user',
                content: `[SYSTEM CONTEXT — DO NOT REPEAT THIS TO THE USER]\n${systemContext}\n\nNow greet the user and start the weekly check-in interview.`,
            });
        } else if (message) {
            await openai.beta.threads.messages.create(activeThreadId, {
                role: 'user',
                content: message,
            });
        }

        // Run assistant
        const run = await openai.beta.threads.runs.createAndPoll(activeThreadId, {
            assistant_id: ASSISTANT_ID,
        });

        if (run.status !== 'completed') {
            throw new Error(`Run failed: ${run.status}`);
        }

        // Get response
        const messages = await openai.beta.threads.messages.list(activeThreadId, {
            order: 'desc',
            limit: 1,
        });

        const assistantMsg = messages.data[0];
        if (!assistantMsg || assistantMsg.role !== 'assistant') {
            throw new Error('No assistant response');
        }

        const textContent = assistantMsg.content.find(c => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
            throw new Error('No text in response');
        }

        const rawText = textContent.text.value;
        const parsed = parseDerekResponse(rawText);
        let responseText = parsed.response;

        // Check for completion marker
        const isComplete = responseText.includes('%%CHECKIN_COMPLETE%%');
        responseText = responseText.replace(/%%CHECKIN_COMPLETE%%/g, '').trim();

        return NextResponse.json({
            response: responseText,
            reaction: parsed.reaction,
            threadId: activeThreadId,
            isComplete,
        });
    } catch (error) {
        console.error('Weekly check-in error:', error);
        return NextResponse.json(
            { error: 'Failed to process check-in' },
            { status: 500 }
        );
    }
}
