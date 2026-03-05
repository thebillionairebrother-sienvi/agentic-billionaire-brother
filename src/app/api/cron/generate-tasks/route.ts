import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import ai, { GEMINI_MODEL } from '@/lib/gemini';
import { DEREK_FULL_PROMPT } from '@/lib/system-prompt';

export const maxDuration = 300; // 5 min max for cron jobs
export const dynamic = 'force-dynamic';

function offsetDate(base: string, days: number): string {
    const [y, m, d] = base.split('-').map(Number);
    const dt = new Date(y, m - 1, d + days);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

export async function GET(request: Request) {
    try {
        // Verify cron secret (Vercel sets this automatically for cron jobs)
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = await createServiceClient();
        const today = new Date().toISOString().split('T')[0];
        const windowEnd = offsetDate(today, 4);

        // Get all users with active execution contracts
        const { data: contracts, error: contractError } = await supabase
            .from('execution_contracts')
            .select(`
                user_id,
                locked_kpi,
                weekly_deliverable,
                strategy:strategy_options(
                    archetype, thesis, channel_focus, offer_shape
                )
            `)
            .order('signed_at', { ascending: false });

        if (contractError || !contracts) {
            console.error('Cron: failed to fetch contracts', contractError);
            return NextResponse.json({ error: 'Failed to fetch contracts' }, { status: 500 });
        }

        // Dedupe by user_id (keep the most recent contract)
        const userContracts = new Map<string, typeof contracts[0]>();
        for (const c of contracts) {
            if (!userContracts.has(c.user_id)) {
                userContracts.set(c.user_id, c);
            }
        }

        let generated = 0;
        let skipped = 0;

        for (const [userId, contract] of userContracts) {
            // Check if tasks already exist in the 5-day window
            const { data: existingTasks } = await supabase
                .from('tasks')
                .select('id')
                .eq('user_id', userId)
                .gte('due_date', today)
                .lte('due_date', windowEnd)
                .limit(1);

            if (existingTasks && existingTasks.length > 0) {
                skipped++;
                continue;
            }

            // Get user context
            const [
                { data: businessProfile },
                { data: currentCycle },
            ] = await Promise.all([
                supabase
                    .from('business_profiles')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single(),
                supabase
                    .from('weekly_cycles')
                    .select('*')
                    .eq('user_id', userId)
                    .order('week_number', { ascending: false })
                    .limit(1)
                    .single(),
            ]);

            if (!businessProfile) {
                skipped++;
                continue;
            }

            const strategy = (Array.isArray(contract.strategy) ? contract.strategy[0] : contract.strategy) as unknown as { archetype: string; thesis: string; channel_focus: string[]; offer_shape: string } | null;
            if (!strategy) {
                skipped++;
                continue;
            }

            const hoursPerWeek = businessProfile.hours_per_week || 10;
            const dailyMinutes = Math.round((hoursPerWeek * 60) / 7);
            const dateObj = new Date(today + 'T00:00:00');
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

            const prompt = `Generate action items starting from ${dayName}, ${today} for this founder.

FOUNDER CONTEXT:
- Business: ${businessProfile.business_name || 'Unknown'} (${businessProfile.industry || 'Unknown industry'})
- Stage: ${businessProfile.business_state || 'unknown'}
- Strengths: ${JSON.stringify(businessProfile.strengths || [])}
- Weaknesses: ${JSON.stringify(businessProfile.weaknesses || [])}
- Existing assets: ${JSON.stringify(businessProfile.existing_assets || [])}

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
3. Be SPECIFIC and actionable
4. Include 3-5 clear, numbered STEPS for how to complete each task
5. Match the founder's current stage and skill level
6. Build toward the weekly deliverable and KPI
7. Each task should feel achievable in one sitting
8. Vary the tasks
9. Each task MUST include a "difficulty" rating from 1 to 5:
   - 1 = Quick win, under 15 min → due TODAY
   - 2 = Short task, 15-30 min → due TOMORROW
   - 3 = Medium task, 30-60 min → due in 2 DAYS
   - 4 = Substantial task, 1-2 hrs → due in 3 DAYS
   - 5 = Deep work, 2+ hrs → due in 4 DAYS
10. Spread tasks across all difficulty levels
11. Each task MUST include "ai_doable" (true/false)

Return ONLY a JSON array:
[
  {
    "title": "short task name",
    "summary": "One sentence explaining what and why",
    "category": "learn|create|outreach|plan|execute|review",
    "difficulty": 1,
    "time_mins": 15,
    "steps": ["Step 1", "Step 2", "Step 3"],
    "tips": "One practical pro tip",
    "ai_doable": true
  }
]`;

            try {
                const response = await ai.models.generateContent({
                    model: GEMINI_MODEL,
                    config: { systemInstruction: DEREK_FULL_PROMPT },
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                });

                const raw = response.text || '';
                const jsonMatch = raw.match(/\[[\s\S]*\]/);
                if (!jsonMatch) throw new Error('No JSON');

                const generatedTasks = JSON.parse(jsonMatch[0]);

                const taskRows = generatedTasks.map((task: {
                    title: string; summary: string; category: string;
                    difficulty: number; time_mins: number; steps: string[];
                    tips: string; ai_doable: boolean;
                }, i: number) => {
                    const difficultyOffset = Math.max(0, Math.min(4, (task.difficulty || 1) - 1));
                    return {
                        weekly_cycle_id: currentCycle?.id,
                        user_id: userId,
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
                        due_date: offsetDate(today, difficultyOffset),
                        sort_order: i,
                    };
                });

                await supabase.from('tasks').insert(taskRows);
                generated++;
            } catch (err) {
                console.error(`Cron: failed to generate tasks for user ${userId}`, err);
                skipped++;
            }
        }

        return NextResponse.json({
            ok: true,
            generated,
            skipped,
            total_users: userContracts.size,
        });
    } catch (error) {
        console.error('Cron error:', error);
        return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
    }
}
