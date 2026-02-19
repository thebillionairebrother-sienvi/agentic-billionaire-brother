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

        const { threadId } = await request.json();

        if (!threadId) {
            return NextResponse.json({ error: 'threadId required' }, { status: 400 });
        }

        // Gather data for summary
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

        // Use the same thread to generate the summary
        await openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: `[SYSTEM — GENERATE WEEKLY SUMMARY]
Based on our entire conversation above, generate a comprehensive weekly summary presentation.

Return a JSON object with this EXACT structure:
{
  "weekNumber": ${currentCycle?.week_number || 1},
  "strategy": "${contract?.strategy?.archetype || 'Your Strategy'}",
  "kpiTarget": "${currentCycle?.kpi_target || 'Not set'}",
  "kpiActual": "extract from conversation",
  "kpiVerdict": "BEAT" or "MISSED" or "MET",
  "tasksCompleted": ${doneTasks.length},
  "tasksTotal": ${tasks.length},
  "topWins": ["win 1", "win 2", "win 3"],
  "killList": ["thing to stop doing"],
  "keepList": ["thing to keep doing"],
  "doubleDownList": ["thing to double down on"],
  "weeklyInsight": "the user's biggest insight/lesson",
  "derekVerdict": "Derek's 2-3 sentence overall assessment of the week",
  "motivationalQuote": "An relevant inspirational quote with attribution",
  "nextWeekFocus": "One sentence about what to focus on next week"
}

Extract KPI data, wins, kill/keep/double items, and insights from the conversation. Be accurate — use what the user actually said.
IMPORTANT: Return ONLY the JSON object, no other text.`,
        });

        // Run assistant
        const run = await openai.beta.threads.runs.createAndPoll(threadId, {
            assistant_id: ASSISTANT_ID,
        });

        if (run.status !== 'completed') {
            throw new Error(`Run failed: ${run.status}`);
        }

        const messages = await openai.beta.threads.messages.list(threadId, {
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

        // Parse the summary JSON
        const raw = textContent.text.value
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

        let summary;
        try {
            summary = JSON.parse(raw);
        } catch {
            // Fallback
            summary = {
                weekNumber: currentCycle?.week_number || 1,
                strategy: contract?.strategy?.archetype || 'Your Strategy',
                kpiTarget: currentCycle?.kpi_target || 'Not set',
                kpiActual: '—',
                kpiVerdict: 'MET',
                tasksCompleted: doneTasks.length,
                tasksTotal: tasks.length,
                topWins: ['Completed the weekly check-in'],
                killList: [],
                keepList: [],
                doubleDownList: [],
                weeklyInsight: 'Keep pushing forward.',
                derekVerdict: raw || 'Great work this week. Keep it up!',
                motivationalQuote: '"Success is not final; failure is not fatal: it is the courage to continue that counts." — Winston Churchill',
                nextWeekFocus: 'Stay consistent and execute on your strategy.',
            };
        }

        // Save summary to the active weekly cycle's board_meeting_notes
        if (currentCycle) {
            await supabase
                .from('weekly_cycles')
                .update({
                    board_meeting_notes: summary,
                    kpi_actual: summary.kpiActual || null,
                    kill_list: summary.killList || [],
                    keep_list: summary.keepList || [],
                    double_list: summary.doubleDownList || [],
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                })
                .eq('id', currentCycle.id);
        }

        return NextResponse.json({ summary });
    } catch (error) {
        console.error('Summary generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate summary' },
            { status: 500 }
        );
    }
}
