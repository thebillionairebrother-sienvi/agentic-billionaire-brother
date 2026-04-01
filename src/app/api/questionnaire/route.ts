import { NextResponse } from 'next/server';
import { createMobileAwareClient } from '@/lib/supabase/server';
import type { QuestionnairePayload } from '@/lib/types';

// Allow enough time for the strategy generation sub-call
export const maxDuration = 60;

// Normalize AI-extracted values to valid DB enums
function normalizeBusinessState(val: string): 'idea' | 'pre-revenue' | 'revenue' | 'scaling' {
    const v = (val || '').toLowerCase().trim();
    if (v.includes('idea') || v.includes('concept')) return 'idea';
    if (v.includes('pre') || v.includes('launch') || v.includes('start')) return 'pre-revenue';
    if (v.includes('scal') || v.includes('grow')) return 'scaling';
    if (v.includes('rev')) return 'revenue';
    return 'idea';
}

function normalizeRiskTolerance(val: string): 'conservative' | 'moderate' | 'aggressive' {
    const v = (val || '').toLowerCase().trim();
    if (v.includes('aggr') || v.includes('high') || v.includes('bold')) return 'aggressive';
    if (v.includes('conserv') || v.includes('low') || v.includes('safe') || v.includes('cautious')) return 'conservative';
    return 'moderate';
}

function normalizeTeamSize(val: string): 'solo' | 'founder_plus_vas' | 'small_team' {
    const v = (val || '').toLowerCase().trim();
    if (v.includes('small') || v.includes('team') || v.includes('employees')) return 'small_team';
    if (v.includes('va') || v.includes('freelanc') || v.includes('contractor') || v.includes('plus')) return 'founder_plus_vas';
    return 'solo';
}

function normalizePayload(body: QuestionnairePayload): QuestionnairePayload {
    return {
        ...body,
        business_state: normalizeBusinessState(body.business_state),
        risk_tolerance: normalizeRiskTolerance(body.risk_tolerance),
        team_size: normalizeTeamSize(body.team_size),
        hours_per_week: Number(body.hours_per_week) || 10,
        va_count: Number(body.va_count) || 0,
        calendar_blocks_available: Number(body.calendar_blocks_available) || 5,
        strengths: Array.isArray(body.strengths) ? body.strengths : [],
        weaknesses: Array.isArray(body.weaknesses) ? body.weaknesses : [],
        no_go_constraints: Array.isArray(body.no_go_constraints) ? body.no_go_constraints : [],
        existing_assets: Array.isArray(body.existing_assets) ? body.existing_assets : [],
        timezone: body.timezone || 'UTC',
    };
}

export async function POST(request: Request) {
    try {
        const { supabase, user } = await createMobileAwareClient(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = normalizePayload(await request.json());

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

        // Fire-and-forget strategy generation — don't block the questionnaire response
        // The frontend will poll /api/jobs/[jobId] to track progress
        const generateUrl = new URL('/api/strategies/generate', request.url).toString();
        fetch(generateUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('cookie') || '',
            },
            body: JSON.stringify({ business_profile_id: profileId }),
        }).catch((err) => {
            console.error('[questionnaire] Fire-and-forget strategy generation failed:', err);
        });

        return NextResponse.json({
            profileId,
            success: true,
        });
    } catch (error) {
        console.error('Questionnaire error:', error);
        return NextResponse.json(
            { error: 'Failed to save questionnaire' },
            { status: 500 }
        );
    }
}
