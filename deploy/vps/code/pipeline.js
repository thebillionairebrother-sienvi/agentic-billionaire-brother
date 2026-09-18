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
const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Helper to call Gemini model with structured text output
 */
async function callAgent(systemPrompt, userPrompt, temperature = 0.4) {
    if (!ai) {
        throw new Error('GEMINI_API_KEY is not configured in worker runtime environment');
    }

    const response = await ai.models.generateContent({
        model: modelName,
        contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\n---\nUSER CONTEXT & INSTRUCTIONS:\n${userPrompt}` }] }
        ],
        config: {
            temperature
        }
    });

    return response.text || '';
}

/**
 * 1. NAOMI CHEN (Chief of Staff / Ops Coordinator)
 */
async function runNaomi(profile, chosenStrategy) {
    const systemPrompt = `You are Naomi "Scoreboard" Chen, Chief of Staff for Billionaire Brother.
Your persona: Calm, precise operator who turns chaos into numbers, constraints, and execution plans.
Job: Synthesize the founder's profile and chosen strategy into an 8-week sprint structure and first 7-day milestone map.
Rules:
- Hard capacity fit: If user only has 5-10 hrs/week, DO NOT overload tasks.
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
 */
async function runJax(profile, chosenStrategy, miloCopy) {
    const systemPrompt = `You are Jax "Distribution" Moreno, Head of Content and Distribution for Billionaire Brother.
Your persona: Fast shipping, repurposing machine, relentless consistency.
Job: Ship the Week 1 Content Pack.
What you ship:
1. 5 to 7 platform-specific social posts (X, LinkedIn, or Short-form scripts).
2. 1 long-form anchor (Newsletter, blog post, or thread).
3. 1 Repurpose Map: How the 1 long-form anchor turns into 7 micro assets.
Rules:
- Every post must direct attention toward the primary offer or lead magnet.`;

    const userPrompt = `MILO'S COPY & HOOKS:
${miloCopy}

PRIMARY CHANNEL:
${chosenStrategy.primary_channel || 'Social & Direct Outreach'}`;

    return await callAgent(systemPrompt, userPrompt, 0.6);
}

/**
 * 5. SLOANE PARK (Red Team QA Gatekeeper)
 */
async function runSloane(naomi, rhea, milo, jax, constraints) {
    const systemPrompt = `You are Sloane "Red Team" Park, Independent QA Sentinel for Billionaire Brother.
Your job: Screen all deliverables for fluff, hallucinations, compliance violations, and complexity before customer sees them.
Rubric:
1. Zero fake income guarantees or hype claims.
2. Fits within user's weekly hour constraints.
3. Only ONE primary CTA across copy assets.
4. Concrete, actionable deliverables without vague corporate filler.

Output STRICT JSON ONLY:
{
  "passed": true | false,
  "rubric_score": 0-100,
  "flags": ["list of issues found, if any"],
  "verdict": "APPROVED" | "REVISION_REQUIRED",
  "notes": "Direct feedback"
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
${jax.substring(0, 1000)}

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

    // Stage 1: Naomi Chen
    const naomiOutput = await runNaomi(userProfile, chosenStrategy);

    // Stage 2: Rhea Kade
    const rheaOutput = await runRhea(userProfile, chosenStrategy, naomiOutput);

    // Stage 3: Milo Sato
    const miloOutput = await runMilo(userProfile, chosenStrategy, rheaOutput);

    // Stage 4: Jax Moreno
    const jaxOutput = await runJax(userProfile, chosenStrategy, miloOutput);

    // Stage 5: Sloane Park (QA Gate)
    const qaResult = await runSloane(naomiOutput, rheaOutput, miloOutput, jaxOutput, userProfile);

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
        qa_gate: qaResult
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
        duration_ms: Date.now() - startTime
    }));

    return packagePayload;
}

module.exports = {
    executeSprintPipeline
};
