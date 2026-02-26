import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID!;

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ taskId: string }> }
) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { taskId } = await params;

        // Get the task
        const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .eq('user_id', user.id)
            .single();

        if (taskError || !task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        // Parse the task description
        let taskMeta: { summary?: string; category?: string; steps?: string[]; ai_doable?: boolean } = {};
        try {
            taskMeta = JSON.parse(task.description || '{}');
        } catch {
            taskMeta = { summary: task.description };
        }

        // Check if AI can do this task
        if (taskMeta.ai_doable === false) {
            return NextResponse.json(
                { error: 'This task requires hands-on execution and cannot be delegated to AI.' },
                { status: 400 }
            );
        }

        // Get business context
        const { data: businessProfile } = await supabase
            .from('business_profiles')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        const { data: contract } = await supabase
            .from('execution_contracts')
            .select('*, strategy:strategy_options(*)')
            .eq('user_id', user.id)
            .order('signed_at', { ascending: false })
            .limit(1)
            .single();

        const strategy = contract?.strategy;

        const prompt = `You are "Derek, The Billionaire Brother" — a successful entrepreneur acting as a big brother mentor. A founder has asked you to COMPLETE the following task for them. Do the actual work and produce a comprehensive, actionable deliverable.

TASK TO COMPLETE:
Title: ${task.title}
Summary: ${taskMeta.summary || ''}
Category: ${taskMeta.category || 'general'}
Steps required: ${JSON.stringify(taskMeta.steps || [])}

FOUNDER'S BUSINESS CONTEXT:
- Business: ${businessProfile?.business_name || 'Unknown'} (${businessProfile?.industry || 'Unknown industry'})
- Stage: ${businessProfile?.business_state || 'unknown'}
- Target audience: ${businessProfile?.target_audience || 'unknown'}
- Strengths: ${JSON.stringify(businessProfile?.strengths || [])}
- Existing assets: ${JSON.stringify(businessProfile?.existing_assets || [])}
${strategy ? `
ACTIVE STRATEGY:
- Archetype: ${strategy.archetype}
- Thesis: ${strategy.thesis}
- Channel focus: ${JSON.stringify(strategy.channel_focus || [])}
- Offer shape: ${strategy.offer_shape || 'unknown'}
- KPIs: ${JSON.stringify(strategy.kpis || [])}
` : ''}

INSTRUCTIONS:
1. Actually DO the task — don't just describe how to do it
2. Produce a complete, ready-to-use deliverable
3. Be specific to this founder's business, not generic
4. Use markdown formatting for readability
5. Include headings, bullet points, and sections as appropriate
6. If the task involves writing copy, write the actual copy
7. If it involves research, do the actual research and present findings
8. If it involves analysis, perform the analysis with specific recommendations
9. End with a "Next Steps" section with 2-3 immediate actions the founder should take

FORMAT: Output in clean Markdown. Start with a title using # heading.`;

        const thread = await openai.beta.threads.create();
        await openai.beta.threads.messages.create(thread.id, {
            role: 'user',
            content: prompt,
        });

        let run = await openai.beta.threads.runs.create(thread.id, {
            assistant_id: ASSISTANT_ID,
        });

        // Poll for completion
        const timeout = Date.now() + 90_000;
        while (run.status === 'in_progress' || run.status === 'queued') {
            if (Date.now() > timeout) throw new Error('Derek timed out');
            await new Promise((r) => setTimeout(r, 2000));
            run = await openai.beta.threads.runs.retrieve(run.id, { thread_id: thread.id });
        }

        if (run.status !== 'completed') {
            throw new Error(`Run failed: ${run.status}`);
        }

        const messages = await openai.beta.threads.messages.list(thread.id, {
            order: 'desc',
            limit: 1,
        });

        const aiMessage = messages.data[0];
        if (!aiMessage || aiMessage.role !== 'assistant') {
            throw new Error('No response from Derek');
        }

        const textContent = aiMessage.content.find((c) => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
            throw new Error('No text in response');
        }

        const output = textContent.text.value;

        // Mark the task as done
        await supabase
            .from('tasks')
            .update({ status: 'done' })
            .eq('id', taskId);

        return NextResponse.json({
            output,
            task_id: taskId,
            completed: true,
        });
    } catch (error) {
        console.error('Derek task error:', error);
        return NextResponse.json(
            { error: 'Derek ran into an issue. Try again later.' },
            { status: 500 }
        );
    }
}
