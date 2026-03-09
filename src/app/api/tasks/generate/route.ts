import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import ai, { GEMINI_MODEL } from '@/lib/gemini';
import { DEREK_FULL_PROMPT } from '@/lib/system-prompt';
import { ThinkingLevel } from '@google/genai';
import { buildAiContext, GuardError, guardErrorResponse, logUsageAndCost } from '@/lib/middleware';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const targetDate = body.date || new Date().toISOString().split('T')[0];

        // ── Guardrail Gate ──
        const ctx = await buildAiContext(supabase, user);

        // Block heavy workflow in degrade mode
        if (ctx.isDegradeMode) {
            return NextResponse.json({
                error_code: 'DEGRADE_MODE',
                user_message: "You're approaching your sprint budget. Focus on execution.",
                retry_allowed: false,
            }, { status: 429 });
        }

        // Helper: offset a YYYY-MM-DD string by N days
        function offsetDate(base: string, days: number): string {
            const [y, m, d] = base.split('-').map(Number);
            const dt = new Date(y, m - 1, d + days);
            const yy = dt.getFullYear();
            const mm = String(dt.getMonth() + 1).padStart(2, '0');
            const dd = String(dt.getDate()).padStart(2, '0');
            return `${yy}-${mm}-${dd}`;
        }

        // Check if tasks already exist in the upcoming 5-day window
        const windowEnd = offsetDate(targetDate, 4);
        const { data: existingTasks } = await supabase
            .from('tasks')
            .select('id')
            .eq('user_id', user.id)
            .gte('due_date', targetDate)
            .lte('due_date', windowEnd)
            .limit(1);

        if (existingTasks && existingTasks.length > 0) {
            return NextResponse.json({ error: 'Tasks already generated for this period' }, { status: 409 });
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

        const prompt = `Generate action items starting from ${dayName}, ${targetDate} for this founder.

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

TIME BUDGET: ${dailyMinutes} minutes per day (${hoursPerWeek} hrs/week total)

GENERATE 5-8 tasks. Rules:
1. Total time across all tasks MUST fit within ${hoursPerWeek} hours for the week
2. Each task needs a CATEGORY from this list: "learn", "create", "outreach", "plan", "execute", "review"
3. Be SPECIFIC and actionable — not "work on marketing" but "Write 3 Instagram captions for your pop-up event"
4. Include 3-5 clear, numbered STEPS for how to complete each task
5. Match the founder's current stage and skill level
6. Build toward the weekly deliverable and KPI
7. Each task should feel achievable in one sitting
8. Vary the tasks — don't repeat the same tasks
9. Each task MUST include a "difficulty" rating from 1 to 5:
   - 1 = Quick win, under 15 min (e.g. reply to an email, bookmark a resource) → due TODAY
   - 2 = Short task, 15-30 min (e.g. write a short post, review analytics) → due TOMORROW
   - 3 = Medium task, 30-60 min (e.g. draft a blog outline, update pricing page) → due in 2 DAYS
   - 4 = Substantial task, 1-2 hrs (e.g. create a landing page, record a video) → due in 3 DAYS
   - 5 = Deep work, 2+ hrs (e.g. build a full pitch deck, write a detailed proposal) → due in 4 DAYS
10. Spread tasks across all difficulty levels — include a mix of quick wins and deep work
11. Each task MUST include "ai_doable" (true/false): whether an AI assistant could complete this task on behalf of the founder.
    - TRUE for: research, writing, analysis, drafting, brainstorming, creating outlines, competitor analysis, writing copy, market research, SEO analysis, creating templates
    - FALSE for: physical actions (go somewhere, meet someone), personal decisions, tasks requiring the founder's unique voice/relationships, anything that requires hands-on execution

Return ONLY a JSON array:
[
  {
    "title": "short task name (5-8 words max)",
    "summary": "One sentence explaining what and why",
    "category": "learn|create|outreach|plan|execute|review",
    "difficulty": 1,
    "time_mins": 15,
    "steps": [
      "Step 1: Do this specific thing",
      "Step 2: Then do this",
      "Step 3: Finally do this"
    ],
    "tips": "One practical pro tip for this task",
    "ai_doable": true
  }
]`;

        const startTime = Date.now();
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            config: {
                systemInstruction: DEREK_FULL_PROMPT,
                maxOutputTokens: ctx.maxOutputTokens,
                thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        const latencyMs = Date.now() - startTime;

        const raw = response.text || '';

        // Parse JSON from response
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error('No JSON array in response');

        interface GeneratedTask {
            title: string;
            summary: string;
            category: string;
            difficulty: number;
            time_mins: number;
            steps: string[];
            tips: string;
            ai_doable: boolean;
        }

        const generatedTasks: GeneratedTask[] = JSON.parse(jsonMatch[0]);

        // Save to DB — compute due_date from difficulty (1=today, 5=+4 days)
        const taskRows = generatedTasks.map((task, i) => {
            const difficultyOffset = Math.max(0, Math.min(4, (task.difficulty || 1) - 1));
            return {
                weekly_cycle_id: currentCycle?.id,
                user_id: user.id,
                title: task.title,
                description: JSON.stringify({
                    summary: task.summary,
                    category: task.category || 'execute',
                    difficulty: task.difficulty || 1,
                    time_mins: task.time_mins || 15,
                    steps: task.steps || [],
                    tips: task.tips || '',
                    ai_doable: task.ai_doable ?? false,
                }),
                status: 'todo',
                due_date: offsetDate(targetDate, difficultyOffset),
                sort_order: i,
            };
        });

        const { data: savedTasks, error: insertError } = await supabase
            .from('tasks')
            .insert(taskRows)
            .select();

        if (insertError) throw insertError;

        // ── Log usage and cost ──
        await logUsageAndCost(supabase, {
            userId: user.id, tier: ctx.tier, endpoint: '/api/tasks/generate',
            inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
            latencyMs, isDegradeMode: ctx.isDegradeMode,
        });

        return NextResponse.json({ tasks: savedTasks || [] });
    } catch (error) {
        if (error instanceof GuardError) {
            return NextResponse.json(guardErrorResponse(error), { status: error.statusCode });
        }
        console.error('Task generation error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate tasks' },
            { status: 500 }
        );
    }
}
