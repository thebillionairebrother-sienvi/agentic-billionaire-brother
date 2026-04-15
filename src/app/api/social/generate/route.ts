import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import ai, { GEMINI_MODEL } from '@/lib/gemini';
import { DEREK_FULL_PROMPT } from '@/lib/system-prompt';
import { ThinkingLevel } from '@google/genai';
import { buildAiContext, GuardError, guardErrorResponse } from '@/lib/middleware';

function extractJSON(text: string): Record<string, unknown> {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    if (cleaned.startsWith('{') || cleaned.startsWith('[')) return JSON.parse(cleaned);
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) throw new Error('No JSON found');
    return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
}

/**
 * Generate AI tweet suggestions based on user's strategy and business context
 */
export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Security: Enforce tier-based AI rate limits on social content generation
    let ctx;
    try {
        ctx = await buildAiContext(supabase, user);
    } catch (err) {
        if (err instanceof GuardError) {
            return NextResponse.json(guardErrorResponse(err), { status: err.statusCode });
        }
        throw err;
    }

    const serviceClient = await createServiceClient();

    // Get social account
    const { data: socialAccount } = await serviceClient
        .from('social_accounts')
        .select('id, platform_username')
        .eq('user_id', user.id)
        .eq('platform', 'twitter')
        .single();

    if (!socialAccount) {
        return NextResponse.json({ error: 'No Twitter account connected' }, { status: 400 });
    }

    // Get context: strategy, business profile, recent tasks
    const { data: decision } = await serviceClient
        .from('decisions')
        .select('chosen_strategy_id')
        .eq('user_id', user.id)
        .eq('status', 'committed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    let strategyContext = 'No strategy locked yet.';
    if (decision?.chosen_strategy_id) {
        const { data: strategy } = await serviceClient
            .from('strategy_options')
            .select('archetype, thesis, channel_focus, offer_shape')
            .eq('id', decision.chosen_strategy_id)
            .single();
        if (strategy) {
            strategyContext = `Strategy: ${strategy.archetype}\nThesis: ${strategy.thesis}\nChannels: ${(strategy.channel_focus as string[])?.join(', ')}\nOffer: ${strategy.offer_shape}`;
        }
    }

    const { data: profile } = await serviceClient
        .from('business_profiles')
        .select('business_name, industry, target_audience')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    const businessContext = profile
        ? `Business: ${profile.business_name || 'unnamed'}\nIndustry: ${profile.industry || 'general'}\nTarget: ${profile.target_audience || 'general audience'}`
        : 'No business profile yet.';

    // Get optional topic from request body (capped for safety)
    let topic = '';
    try {
        const body = await request.json();
        const rawTopic = body.topic || '';
        topic = typeof rawTopic === 'string' ? rawTopic.slice(0, 200) : '';
    } catch { /* no body is fine */ }

    const prompt = `You are a JSON-only API. Generate exactly 5 tweet suggestions for @${socialAccount.platform_username}.

CONTEXT:
${strategyContext}
${businessContext}
${topic ? `TOPIC FOCUS: ${topic}` : ''}

RULES:
1. Each tweet MUST be under 280 characters
2. Write in a confident, punchy founder voice — NOT corporate
3. Mix types: value bombs, hot takes, personal stories, engagement questions, thread starters
4. Include relevant hashtags (1-2 max per tweet)
5. Make them scroll-stopping — not generic motivational garbage

Return ONLY this JSON:
{
  "tweets": [
    {
      "content": "The tweet text under 280 chars",
      "post_type": "tweet",
      "rationale": "Why this tweet will drive engagement"
    }
  ]
}`;

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            config: {
                systemInstruction: DEREK_FULL_PROMPT,
                responseMimeType: 'application/json',
                maxOutputTokens: ctx.maxOutputTokens,
                thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        const rawText = response.text || '';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsed = extractJSON(rawText) as any;

        if (!Array.isArray(parsed.tweets) || parsed.tweets.length === 0) {
            throw new Error('No tweets in AI response');
        }

        // Save to social_posts
        const posts = [];
        for (const tweet of parsed.tweets) {
            const { data: post, error } = await serviceClient
                .from('social_posts')
                .insert({
                    user_id: user.id,
                    social_account_id: socialAccount.id,
                    content: tweet.content?.substring(0, 280) || '',
                    post_type: tweet.post_type || 'tweet',
                    status: 'draft',
                    ai_rationale: tweet.rationale || '',
                })
                .select()
                .single();

            if (!error && post) posts.push(post);
        }

        return NextResponse.json({ posts, count: posts.length });

    } catch (err) {
        if (err instanceof GuardError) {
            return NextResponse.json(guardErrorResponse(err), { status: err.statusCode });
        }
        console.error('[social/generate] Error:', err);
        return NextResponse.json(
            { error: 'Content generation failed. Please try again.' },
            { status: 500 }
        );
    }
}
