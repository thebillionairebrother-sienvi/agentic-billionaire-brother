/**
 * AI Middleware — Kill Switch Check
 * Checks global kill switches before any AI operation.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { GuardError } from './types';
import { KILL_SWITCH_IDS } from '@/lib/ai-config';

export async function checkKillSwitch(
    supabase: SupabaseClient,
    switchId: string = KILL_SWITCH_IDS.AI_LAYER
): Promise<void> {
    const { data } = await supabase
        .from('kill_switches')
        .select('enabled, reason')
        .eq('id', switchId)
        .single();

    if (data?.enabled) {
        throw new GuardError(
            'KILL_SWITCH_ACTIVE',
            'AI services are temporarily unavailable. Try again later.',
            503,
            true
        );
    }
}
