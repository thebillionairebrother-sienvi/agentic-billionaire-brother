import { NextResponse } from 'next/server';
import { createMobileAwareClient } from '@/lib/supabase/server';

export const revalidate = 0; // Don't cache admin metrics on CDN

export async function GET(request: Request) {
    try {
        const { supabase, user } = await createMobileAwareClient(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Ideally, we'd check if user is an admin here. Assuming admin route protection handles this.

        // Initialize variables
        let mrr = 0;
        let newPaidToday = 0;
        let churnToday = 0;
        let activationRate = 0;
        let timeToRevenueAvgDays = 0;
        let aiCostPerUser = 0;
        let sprintCompletionPercentage = 0;

        // 1. Fetch Subscription Data for MRR
        const todayStr = new Date().toISOString().split('T')[0]; // Simple YYYY-MM-DD
        
        // This is an MRR calculation waiting for actual receipt values from Stripe API
        const { data: subscriptions } = await supabase
            .from('subscriptions')
            .select('status, tier, charter_pricing, created_at, updated_at');

        if (subscriptions) {
            let totalMonthlyRevenue = 0;
            let activeCount = 0;
            subscriptions.forEach((sub: any) => {
                if (sub.status === 'active' || sub.status === 'trialing') {
                    // Start with base price
                    let price = sub.tier === 'team' ? 199 : 99.99;
                    if (sub.charter_pricing) price = price * 0.8; // 20% off
                    totalMonthlyRevenue += price;
                    activeCount++;

                    // new paid today
                    if (sub.created_at.startsWith(todayStr)) {
                        newPaidToday++;
                    }
                } else if (sub.status === 'cancelled' && sub.updated_at.startsWith(todayStr)) {
                    churnToday++;
                }
            });
            mrr = totalMonthlyRevenue;
        }

        // 2. Activation Rate (7-day)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const { data: recentJoiners } = await supabase
            .from('revenue_events')
            .select('join_date, sprint_1_shipped_date')
            .gte('join_date', sevenDaysAgo.toISOString());
        
        if (recentJoiners && recentJoiners.length > 0) {
            const activated = recentJoiners.filter(r => !!r.sprint_1_shipped_date).length;
            activationRate = Math.round((activated / recentJoiners.length) * 100);
        }

        // 3. Time to Revenue Event (rolling avg)
        const { data: revenueAchievers } = await supabase
            .from('revenue_events')
            .select('join_date, revenue_event_date')
            .not('revenue_event_date', 'is', null);
            
        if (revenueAchievers && revenueAchievers.length > 0) {
            const totalDays = revenueAchievers.reduce((acc, row) => {
                const diffTime = Math.abs(new Date(row.revenue_event_date!).getTime() - new Date(row.join_date).getTime());
                return acc + Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            }, 0);
            timeToRevenueAvgDays = Math.round(totalDays / revenueAchievers.length);
        }

        // 4. AI Cost Per User (Current Month)
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1); // 1st of the month
        currentMonthStart.setHours(0,0,0,0);
        
        const { data: usageData } = await supabase
            .from('usage_monthly_workspace')
            .select('estimated_cost')
            .gte('month_start', currentMonthStart.toISOString().split('T')[0]);
            
        let totalAICost = 0;
        if (usageData && usageData.length > 0) {
            totalAICost = usageData.reduce((acc, row) => acc + Number(row.estimated_cost || 0), 0);
            aiCostPerUser = Number((totalAICost / usageData.length).toFixed(4));
        }

        // Calculate Gross Margin dynamically
        const grossMargin = mrr > 0 ? Math.round(((mrr - totalAICost) / mrr) * 100) : 100;

        // 5. Sprint Completion %
        const { data: weeklyCycles } = await supabase
            .from('weekly_cycles')
            .select('status')
            .in('status', ['active', 'completed']);
            
        if (weeklyCycles && weeklyCycles.length > 0) {
            const completed = weeklyCycles.filter(c => c.status === 'completed').length;
            sprintCompletionPercentage = Math.round((completed / weeklyCycles.length) * 100);
        }

        return NextResponse.json({
            success: true,
            data: {
                mrr,
                newPaidToday,
                churnToday,
                activationRate,
                timeToRevenueAvgDays,
                aiCostPerUser,
                sprintCompletionPercentage,
                grossMargin,
                emailToPaidPercentage: 14 // Placeholder hardcode (From Sienvi)
            }
        });

    } catch (error) {
        console.error('Admin metrics error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch admin metrics' },
            { status: 500 }
        );
    }
}
