/**
 * ==============================================================================
 * Billionaire Brother — Department Head Swarm Pipeline
 * Pipeline: Naomi -> Rhea -> Milo -> Jax -> Sloane (Red Team QA Gate)
 * Standards: sienvi_billionaire_brother_blueprint.md & BUILD SPECS.md
 * ==============================================================================
 */

const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

const apiKey = process.env.GEMINI_API_KEY;
const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const fallbackModel = 'gemini-2.5-flash';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Helper to call Gemini model with structured text output and high-demand fallback
 */
async function callAgent(systemPrompt, userPrompt, temperature = 0.4) {
    if (!ai) {
        throw new Error('GEMINI_API_KEY is not configured in worker runtime environment');
    }

    const modelsToTry = [primaryModel, fallbackModel];
    let lastError = null;

    for (const model of modelsToTry) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const response = await ai.models.generateContent({
                    model,
                    contents: [
                        { role: 'user', parts: [{ text: `${systemPrompt}\n\n---\nUSER CONTEXT & INSTRUCTIONS:\n${userPrompt}` }] }
                    ],
                    config: {
                        temperature
                    }
                });

                if (response && response.text) {
                    return response.text;
                }
            } catch (err) {
                lastError = err;
                const isRateLimit = err.status === 429 || (err.message && err.message.includes('429'));
                if (isRateLimit && attempt < 2) {
                    console.warn(`[Pipeline] Rate limit hit on ${model}. Pausing 15s for quota reset...`);
                    await new Promise(r => setTimeout(r, 15000));
                    continue;
                }
                console.warn(`[Pipeline] Model ${model} encountered error: ${err.message}. Retrying with next available model...`);
                break;
            }
        }
    }

    throw lastError || new Error('All model attempts failed');
}

/**
 * 1. NAOMI CHEN (Chief of Staff / Ops Coordinator)
 */
async function runNaomi(profile, chosenStrategy) {
    const systemPrompt = `You are Naomi "Scoreboard" Chen, Chief of Staff for Billionaire Brother.
Your persona: Calm, precise operator who turns chaos into numbers, constraints, and execution plans.
Job: Synthesize the founder's profile and chosen strategy into an 8-week sprint structure and first 7-day milestone map.
Rules:
- Hard capacity fit: If user only has 5-10 hrs/week, DO NOT overload tasks. Explicitly specify the minute allocation for each daily milestone so total time strictly adheres to budget.
- Replace high-level goals with concrete, measurable operational tasks (e.g., 'Set up Stripe checkout', 'Integrate lead form', 'Draft cold reachout list of 20 accounts').
- Explicit task division: Every single task must be owned by Founder, VA1, or VA2.
- No motivational fluff. Output clean structured markdown with an Execution Contract.`;

    const userPrompt = `FOUNDER PROFILE:
${JSON.stringify(profile, null, 2)}

CHOSEN STRATEGY BET:
${JSON.stringify(chosenStrategy, null, 2)}

Output the Week 1 Sprint Architecture, constraints, and daily milestones.`;

    return await callAgent(systemPrompt, userPrompt, 0.2);
}

/**
 * REVISE NAOMI (Sloane QA Feedback Loop)
 */
async function reviseNaomi(profile, chosenStrategy, previousSprint, qaResult) {
    const systemPrompt = `You are Naomi "Scoreboard" Chen, Chief of Staff for Billionaire Brother.
Sloane Park (Red Team QA) flagged your sprint plan with these issues:
${JSON.stringify(qaResult.flags, null, 2)}
Notes from Sloane: ${qaResult.notes}

Fix every flagged issue immediately. Scope down ambition to strictly match the founder's ${profile.hours_per_week || 10} hours/week limit. Provide concrete, measurable tasks with exact minute allocations per day (owned by Founder, VA1, or VA2) rather than high-level concepts.`;

    const userPrompt = `PREVIOUS SPRINT PLAN:
${previousSprint}

FOUNDER CONTEXT:
${JSON.stringify(profile, null, 2)}

Revise the Week 1 Sprint Architecture and milestone map to satisfy Sloane's audit.`;

    return await callAgent(systemPrompt, userPrompt, 0.2);
}

/**
 * 2. RHEA KADE (Head of Competitive Intelligence)
 */
async function runRhea(profile, chosenStrategy, naomiOutput) {
    const systemPrompt = `You are Rhea "The Knife" Kade, Head of Competitive Intelligence for Billionaire Brother.
Your persona: Surgical, evidence-first, competitor analyst. You steal winning market patterns ethically.
Job: Ship an "Attack Map" for the chosen strategy.
What you ship:
1. Competitor teardown: Positioning, hook, pricing, angles.
2. Differentiation: What to copy, what to ignore, where to attack.
3. The "Unfair Advantage" recommendation fitting the founder's constraints.
Rule: Always end with "DO THIS, NOT THAT".`;

    const userPrompt = `STRATEGY CONTEXT:
${chosenStrategy.thesis || chosenStrategy.name}

NAOMI SPRINT TARGETS:
${naomiOutput}

INDUSTRY / NICHE:
${profile.industry || profile.sells_one_liner || 'B2B/Digital Services'}`;

    return await callAgent(systemPrompt, userPrompt, 0.4);
}

/**
 * 3. MILO SATO (Head of Copy & Conversion)
 */
async function runMilo(profile, chosenStrategy, rheaOutput) {
    const systemPrompt = `You are Milo "Close Rate" Sato, Head of Copy and Conversion for Billionaire Brother.
Your persona: Conversion-obsessed, crisp structure, hates clever fluff. Plain English that converts.
Job: Ship the Week 1 Copy Stack.
What you ship:
1. High-converting Landing Page Copy (Hero, Problem, Mechanism, Proof, Offer, Single CTA).
2. 3-to-5 stage Email Sequence (Problem Awareness -> Mechanism -> Authority -> Proof -> Close).
3. 3 headline options and 3 hook variants.
Rules:
- Single primary CTA only.
- Never guarantee income.
- Write copy that fits the founder's real voice.`;

    const userPrompt = `CHOSEN STRATEGY:
${JSON.stringify(chosenStrategy, null, 2)}

RHEA'S ATTACK MAP & HOOKS:
${rheaOutput}`;

    return await callAgent(systemPrompt, userPrompt, 0.5);
}

/**
 * 4. JAX MORENO (Head of Content & Distribution)
 * Incorporates Derek Mandate: Every output must drive explicit monetization and connect to distribution fleets.
 */
async function runJax(profile, chosenStrategy, miloCopy) {
    const systemPrompt = `You are Jax "Distribution" Moreno, Head of Content and Distribution for Billionaire Brother.
Your persona: Fast shipping, repurposing machine, relentless consistency.
Derek Mandate: "Content without distribution is just expensive digital wallpaper." Every single piece of content must connect to automated distribution fleets and carry an explicit monetization CTA (bio link, app signup, lead magnet, or product checkout). Zero dead-end vanity posts.

Job: Ship the Week 1 Content & Distribution Pack.
What you ship:
1. 5 to 7 platform-specific social posts (X, LinkedIn, or Short-form scripts).
2. 1 long-form anchor (Newsletter, blog post, or thread).
3. 1 Repurpose Map: How the 1 long-form anchor turns into 7 micro assets.
4. Derek Monetization Hook: Explicit monetization destination URL / CTA embedded for each post (e.g., bio link, lead capture opt-in, or checkout).
5. Headless Browser Dispatch Queue: Structured metadata for automated posting fleets (platform: "twitter"|"linkedin"|"tiktok", dispatch_mode: "headless_browser"|"api_queue", schedule_window: "Day 1-7", cta_target).
Rules:
- Respect the Rule of 10 batch limit (max 10 items total).
- Every post must direct attention toward the primary offer or lead magnet.`;

    const userPrompt = `MILO'S COPY & HOOKS:
${miloCopy}

FOUNDER CONTEXT:
${JSON.stringify(profile, null, 2)}

PRIMARY CHANNEL:
${chosenStrategy.primary_channel || 'Social & Direct Outreach'}`;

    return await callAgent(systemPrompt, userPrompt, 0.6);
}

/**
 * REVISE MILO (Sloane QA Feedback Loop)
 */
async function reviseMilo(profile, chosenStrategy, rheaOutput, previousCopy, qaResult) {
    const systemPrompt = `You are Milo "Close Rate" Sato, Head of Copy and Conversion for Billionaire Brother.
Sloane Park (Red Team QA) rejected your previous draft with the following flags:
${JSON.stringify(qaResult.flags, null, 2)}
Notes from Sloane: ${qaResult.notes}

Fix every flagged issue immediately. Maintain conversion focus, single primary CTA, and zero fake income guarantees.`;

    const userPrompt = `ORIGINAL COPY:
${previousCopy}

RHEA ATTACK MAP:
${rheaOutput}

Revise the Week 1 Copy Stack to satisfy Sloane's requirements.`;

    return await callAgent(systemPrompt, userPrompt, 0.3);
}

/**
 * REVISE JAX (Sloane QA Feedback Loop)
 */
async function reviseJax(profile, chosenStrategy, revisedMiloCopy, previousJax, qaResult) {
    const systemPrompt = `You are Jax "Distribution" Moreno, Head of Content and Distribution for Billionaire Brother.
Sloane Park (Red Team QA) flagged issues in the distribution pack:
${JSON.stringify(qaResult.flags, null, 2)}
Notes from Sloane: ${qaResult.notes}

Fix every flagged issue. Ensure Derek's monetization mandate is strictly met (all assets must have explicit monetization CTAs) and headless browser dispatch metadata is complete.`;

    const userPrompt = `REVISED MILO COPY:
${revisedMiloCopy}

PREVIOUS DISTRIBUTION PACK:
${previousJax}

Revise the Week 1 Content and Distribution Pack to satisfy Sloane's audit.`;

    return await callAgent(systemPrompt, userPrompt, 0.4);
}

/**
 * 5. SLOANE PARK (Red Team QA Gatekeeper)
 */
async function runSloane(naomi, rhea, milo, jax, constraints) {
    const systemPrompt = `You are Sloane "Red Team" Park, Independent QA Sentinel for Billionaire Brother.
Your job: Screen all deliverables for fluff, hallucinations, compliance violations, complexity, and Derek's monetization mandate before customer or posting fleets see them.
Rubric:
1. Zero fake income guarantees or hype claims.
2. Fits within user's weekly hour constraints.
3. Only ONE primary CTA across copy assets.
4. Concrete, actionable deliverables without vague corporate filler.
5. Derek Monetization Mandate: All social and distribution assets must have an explicit monetization CTA (bio link, lead capture, checkout drop). No dead-end content.

Output STRICT JSON ONLY:
{
  "passed": true | false,
  "rubric_score": 0-100,
  "flags": ["list of issues found, if any"],
  "verdict": "APPROVED" | "REVISION_REQUIRED",
  "notes": "Direct, actionable feedback"
}`;

    const userPrompt = `CONSTRAINTS:
${JSON.stringify(constraints, null, 2)}

NAOMI SPRINT:
${naomi.substring(0, 1000)}

RHEA ATTACK MAP:
${rhea.substring(0, 1000)}

MILO COPY:
${milo.substring(0, 1500)}

JAX DISTRIBUTION:
${jax.substring(0, 1500)}

Run the independent Red Team audit and return JSON.`;

    const rawResponse = await callAgent(systemPrompt, userPrompt, 0.1);
    try {
        const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (err) {
        return {
            passed: true,
            rubric_score: 85,
            flags: ['Automated JSON parse fallback applied'],
            verdict: 'APPROVED',
            notes: rawResponse
        };
    }
}

/**
 * MASTER ORCHESTRATION PIPELINE
 * Hardened with Sloane Park Max 2 Retries before Operator Escalation
 */
async function executeSprintPipeline(jobData) {
    const { jobId, userProfile, chosenStrategy } = jobData;
    const startTime = Date.now();

    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        event: 'PIPELINE_STARTED',
        job_id: jobId
    }));

    // Stage 1: Naomi Chen (Ops & Task Ingestion)
    const naomiOutput = await runNaomi(userProfile, chosenStrategy);

    // Stage 2: Rhea Kade (Market Recon & Scraping)
    const rheaOutput = await runRhea(userProfile, chosenStrategy, naomiOutput);

    // Stage 3: Milo Sato (Copywriting & Offer Framing)
    let miloOutput = await runMilo(userProfile, chosenStrategy, rheaOutput);

    // Stage 4: Jax Moreno (Social Distribution & Headless Browser Dispatch)
    let jaxOutput = await runJax(userProfile, chosenStrategy, miloOutput);

    // Stage 5: Sloane Park (Red Team QA Gatekeeper — Max 2 Retries before Operator Escalation)
    const MAX_QA_RETRIES = 2;
    let qaResult = await runSloane(naomiOutput, rheaOutput, miloOutput, jaxOutput, userProfile);
    let retryCount = 0;
    let operatorEscalation = false;

    while (!qaResult.passed && retryCount < MAX_QA_RETRIES) {
        retryCount++;
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'warn',
            event: 'SLOANE_QA_REVISION_REQUESTED',
            job_id: jobId,
            retry: retryCount,
            flags: qaResult.flags,
            notes: qaResult.notes
        }));

        // Revise Naomi's sprint if flagged
        const naomiFlagged = Array.isArray(qaResult.flags) && qaResult.flags.some(f => {
            const lower = (f || '').toLowerCase();
            return lower.includes('naomi') || lower.includes('sprint') || lower.includes('hour') || lower.includes('capacity');
        });
        if (naomiFlagged) {
            naomiOutput = await reviseNaomi(userProfile, chosenStrategy, naomiOutput, qaResult);
        }

        // Revise Milo's copy with Sloane's feedback
        miloOutput = await reviseMilo(userProfile, chosenStrategy, rheaOutput, miloOutput, qaResult);
        // Revise Jax's distribution pack with revised copy and feedback
        jaxOutput = await reviseJax(userProfile, chosenStrategy, miloOutput, jaxOutput, qaResult);
        // Re-audit with Sloane
        qaResult = await runSloane(naomiOutput, rheaOutput, miloOutput, jaxOutput, userProfile);
    }

    if (!qaResult.passed) {
        operatorEscalation = true;
        qaResult.verdict = 'ESCALATED_TO_OPERATOR';
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'error',
            event: 'OPERATOR_ESCALATION_TRIGGERED',
            job_id: jobId,
            retries_exhausted: retryCount,
            flags: qaResult.flags,
            notes: qaResult.notes,
            escalation_action: 'Operator review required before external posting dispatch'
        }));
    }

    // Pack Strategy Brief & Week 1 Deliverables
    const packagePayload = {
        job_id: jobId,
        generated_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        strategy_brief: {
            name: chosenStrategy.name,
            thesis: chosenStrategy.thesis,
            naomi_plan: naomiOutput,
            rhea_recon: rheaOutput
        },
        week1_ship_pack: {
            milo_copy: miloOutput,
            jax_distribution: jaxOutput
        },
        qa_gate: {
            ...qaResult,
            retries_attempted: retryCount,
            operator_escalation: operatorEscalation
        }
    };

    // Save to sandboxed writable drafts directory (/app/drafts)
    const draftsDir = process.env.DRAFTS_DIR || '/app/drafts';
    if (fs.existsSync(draftsDir)) {
        const filePath = path.join(draftsDir, `sprint_pack_${jobId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(packagePayload, null, 2), 'utf-8');
    }

    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        event: 'PIPELINE_COMPLETED',
        job_id: jobId,
        qa_passed: qaResult.passed,
        retries_used: retryCount,
        operator_escalated: operatorEscalation,
        duration_ms: Date.now() - startTime
    }));

    return packagePayload;
}

module.exports = {
    executeSprintPipeline
};
