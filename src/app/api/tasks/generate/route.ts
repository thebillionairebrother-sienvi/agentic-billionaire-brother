import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import openai, { ASSISTANT_ID } from '@/lib/openai';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const targetDate = body.date || new Date().toISOString().split('T')[0];

        // Check if tasks already exist for this date
        const { data: existingTasks } = await supabase
            .from('tasks')
            .select('id')
            .eq('user_id', user.id)
            .eq('due_date', targetDate)
            .limit(1);

        if (existingTasks && existingTasks.length > 0) {
            return NextResponse.json({ error: 'Tasks already generated for this date' }, { status: 409 });
        }

        // Fetch user context
        const [
            { data: businessProfile },
            { data: contract },
            { data: currentCycle },
        ] = await Promise.all([
            supabase
                .from('business_profiles')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single(),
            supabase
                .from('execution_contracts')
                .select('*, strategy:strategy_options(*)')
                .eq('user_id', user.id)
                .order('signed_at', { ascending: false })
                .limit(1)
                .single(),
            supabase
                .from('weekly_cycles')
                .select('*')
                .eq('user_id', user.id)
                .order('week_number', { ascending: false })
                .limit(1)
                .single(),
        ]);

        if (!contract?.strategy) {
            return NextResponse.json({ error: 'No active strategy found' }, { status: 400 });
        }

        const hoursPerWeek = businessProfile?.hours_per_week || 10;
        const dailyMinutes = Math.round((hoursPerWeek * 60) / 7);
        const strategy = contract.strategy;

        // Calculate day context
        const dateObj = new Date(targetDate + 'T00:00:00');
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

        const prompt = `You are "The Billionaire Brother" — a no-BS business mentor. Generate action items for ${dayName}, ${targetDate} for this founder.

FOUNDER CONTEXT:
- Business: ${businessProfile?.business_name || 'Unknown'} (${businessProfile?.industry || 'Unknown industry'})
- Stage: ${businessProfile?.business_state || 'unknown'}
- Strengths: ${JSON.stringify(businessProfile?.strengths || [])}
- Weaknesses: ${JSON.stringify(businessProfile?.weaknesses || [])}
- Existing assets: ${JSON.stringify(businessProfile?.existing_assets || [])}

ACTIVE STRATEGY:
- Archetype: ${strategy.archetype}
- Thesis: ${strategy.thesis}
- Channel focus: ${JSON.stringify(strategy.channel_focus || [])}
- Offer shape: ${strategy.offer_shape || 'unknown'}
- Locked KPI: ${contract.locked_kpi}
- Weekly deliverable: ${contract.weekly_deliverable}

CURRENT WEEK: ${currentCycle?.week_number || 1} (${currentCycle?.status || 'active'})
${currentCycle?.kpi_target ? `KPI target this week: ${currentCycle.kpi_target}` : ''}

TIME BUDGET: ${dailyMinutes} minutes for the day (${hoursPerWeek} hrs/week total)

GENERATE 3-5 tasks for ${dayName}. Rules:
1. Total time across all tasks MUST fit within ${dailyMinutes} minutes
2. Each task needs a CATEGORY from this list: "learn", "create", "outreach", "plan", "execute", "review"
3. Be SPECIFIC and actionable — not "work on marketing" but "Write 3 Instagram captions for your pop-up event"
4. Include 3-5 clear, numbered STEPS for how to complete each task
5. Match the founder's current stage and skill level
6. Build toward the weekly deliverable and KPI
7. Each task should feel achievable in one sitting
8. Vary the tasks from day to day — don't repeat the same tasks

Return ONLY a JSON array:
[
  {
    "title": "short task name (5-8 words max)",
    "summary": "One sentence explaining what and why",
    "category": "learn|create|outreach|plan|execute|review",
    "time_mins": 15,
    "steps": [
      "Step 1: Do this specific thing",
      "Step 2: Then do this",
      "Step 3: Finally do this"
    ],
    "tips": "One practical pro tip for this task"
  }
]`;

        const thread = await openai.beta.threads.create();
        await openai.beta.threads.messages.create(thread.id, {
            role: 'user',
            content: prompt,
        });

        let run = await openai.beta.threads.runs.create(thread.id, {
            assistant_id: ASSISTANT_ID,
        });

        // Poll
        const timeout = Date.now() + 60_000;
        while (run.status === 'in_progress' || run.status === 'queued') {
            if (Date.now() > timeout) throw new Error('Task generation timed out');
            await new Promise((r) => setTimeout(r, 1500));
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
            throw new Error('No response from AI');
        }

        const textContent = aiMessage.content.find((c) => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
            throw new Error('No text in response');
        }

        // Parse JSON from response
        const raw = textContent.text.value;
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error('No JSON array in response');

        interface GeneratedTask {
            title: string;
            summary: string;
            category: string;
            time_mins: number;
            steps: string[];
            tips: string;
        }

        const generatedTasks: GeneratedTask[] = JSON.parse(jsonMatch[0]);

        // Save to DB — store rich data in description as JSON
        const taskRows = generatedTasks.map((task, i) => ({
            weekly_cycle_id: currentCycle?.id,
            user_id: user.id,
            title: task.title,
            description: JSON.stringify({
                summary: task.summary,
                category: task.category || 'execute',
                time_mins: task.time_mins || 15,
                steps: task.steps || [],
                tips: task.tips || '',
            }),
            status: 'todo',
            due_date: targetDate,
            sort_order: i,
        }));

        const { data: savedTasks, error: insertError } = await supabase
            .from('tasks')
            .insert(taskRows)
            .select();

        if (insertError) throw insertError;

        return NextResponse.json({ tasks: savedTasks || [] });
    } catch (error) {
        console.error('Task generation error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate tasks' },
            { status: 500 }
        );
    }
}
