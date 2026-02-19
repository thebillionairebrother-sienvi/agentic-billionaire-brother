import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { QuestionnairePayload } from '@/lib/types';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body: QuestionnairePayload = await request.json();

        // Upsert business profile
        const { data: existingProfile } = await supabase
            .from('business_profiles')
            .select('id')
            .eq('user_id', user.id)
            .single();

        let profileId: string;

        if (existingProfile) {
            const { error } = await supabase
                .from('business_profiles')
                .update({
                    business_name: body.business_name,
                    business_state: body.business_state,
                    industry: body.industry,
                    current_revenue_range: body.current_revenue_range,
                    strengths: body.strengths,
                    weaknesses: body.weaknesses,
                    risk_tolerance: body.risk_tolerance,
                    hours_per_week: body.hours_per_week,
                    monthly_budget_range: body.monthly_budget_range,
                    no_go_constraints: body.no_go_constraints,
                    target_audience: body.target_audience,
                    existing_assets: body.existing_assets,
                    additional_context: body.additional_context,
                    raw_answers: body as unknown as Record<string, unknown>,
                })
                .eq('id', existingProfile.id);

            if (error) throw error;
            profileId = existingProfile.id;
        } else {
            const { data: newProfile, error } = await supabase
                .from('business_profiles')
                .insert({
                    user_id: user.id,
                    business_name: body.business_name,
                    business_state: body.business_state,
                    industry: body.industry,
                    current_revenue_range: body.current_revenue_range,
                    strengths: body.strengths,
                    weaknesses: body.weaknesses,
                    risk_tolerance: body.risk_tolerance,
                    hours_per_week: body.hours_per_week,
                    monthly_budget_range: body.monthly_budget_range,
                    no_go_constraints: body.no_go_constraints,
                    target_audience: body.target_audience,
                    existing_assets: body.existing_assets,
                    additional_context: body.additional_context,
                    raw_answers: body as unknown as Record<string, unknown>,
                })
                .select('id')
                .single();

            if (error) throw error;
            profileId = newProfile!.id;
        }

        // Upsert founder profile
        const { data: existingFounder } = await supabase
            .from('founder_profiles')
            .select('id')
            .eq('user_id', user.id)
            .single();

        if (existingFounder) {
            await supabase
                .from('founder_profiles')
                .update({
                    team_size: body.team_size,
                    va_count: body.va_count,
                    calendar_blocks_available: body.calendar_blocks_available,
                    timezone: body.timezone,
                })
                .eq('id', existingFounder.id);
        } else {
            await supabase
                .from('founder_profiles')
                .insert({
                    user_id: user.id,
                    team_size: body.team_size,
                    va_count: body.va_count,
                    calendar_blocks_available: body.calendar_blocks_available,
                    timezone: body.timezone,
                });
        }

        // Mark onboarding complete
        await supabase
            .from('users')
            .update({ onboarding_complete: true })
            .eq('id', user.id);

        // Auto-trigger strategy generation
        const genRes = await fetch(new URL('/api/strategies/generate', request.url).toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('cookie') || '',
            },
            body: JSON.stringify({ business_profile_id: profileId }),
        });

        const genData = await genRes.json();

        return NextResponse.json({
            profileId,
            jobId: genData.jobId,
        });
    } catch (error) {
        console.error('Questionnaire error:', error);
        return NextResponse.json(
            { error: 'Failed to save questionnaire' },
            { status: 500 }
        );
    }
}
