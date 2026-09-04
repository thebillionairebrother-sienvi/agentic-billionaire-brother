import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3000';
const RECORDINGS_DIR = path.resolve(__dirname, '../recordings');
const ARTIFACTS_DIR = 'C:\\Users\\spenc\\.gemini\\antigravity\\brain\\922b7498-d844-4957-b5ed-6894c83a7f1e';

if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function smoothType(page, selector, text, baseDelay = 28) {
    const element = page.locator(selector);
    await element.click();
    await sleep(200);
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        await page.keyboard.type(char);
        const variance = Math.floor(Math.random() * 20) - 10;
        await sleep(Math.max(15, baseDelay + variance));
    }
    await sleep(400);
}

async function smoothScroll(page, targetY, duration = 600) {
    await page.evaluate(async ({ targetY, duration }) => {
        const startY = window.scrollY;
        const diff = targetY - startY;
        const startTime = performance.now();

        await new Promise(resolve => {
            function step(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Ease-in-out curve
                const ease = progress < 0.5
                    ? 2 * progress * progress
                    : -1 + (4 - 2 * progress) * progress;

                window.scrollTo(0, startY + diff * ease);

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    resolve();
                }
            }
            requestAnimationFrame(step);
        });
    }, { targetY, duration });
    await sleep(300);
}

async function run() {
    console.log('🚀 Starting Billionaire Brother Showcase Recording...');

    const browser = await chromium.launch({
        headless: false,
        args: [
            '--window-size=1920,1080',
            '--disable-blink-features=AutomationControlled',
        ],
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        recordVideo: {
            dir: RECORDINGS_DIR,
            size: { width: 1920, height: 1080 },
        },
    });

    const page = await context.newPage();

    try {
        // ── 1. Navigate to Auth / Login ──
        console.log('1. Navigating to Auth page...');
        await page.goto(`${BASE_URL}/auth`, { waitUntil: 'networkidle' });
        await sleep(1500);

        // Fill in credentials
        console.log('Filling in login credentials...');
        await smoothType(page, '#email', 'spenceralmodiel@gmail.com', 25);
        await sleep(300);
        await smoothType(page, '#password', '12345678', 25);
        await sleep(600);

        // Click Access System
        console.log('Logging in...');
        await page.click('#auth-submit-btn');
        try {
            await page.waitForURL(url => !url.pathname.endsWith('/auth'), { timeout: 15000 });
        } catch {
            await page.waitForLoadState('networkidle');
        }
        await sleep(2500);

        // ── 2. Reset Account to showcase Reset feature & start fresh Onboarding ──
        console.log('2. Demonstrating Reset Account Data feature in Settings...');
        await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
        await sleep(2000);

        // Wait for reset account button to be visible
        const resetBtn = page.locator('#settings-reset-account-btn');
        await resetBtn.waitFor({ state: 'visible', timeout: 30000 });
        console.log('Scrolling down to Danger Zone in Settings...');
        await smoothScroll(page, 900, 1000);
        await sleep(1500);

        // Click Reset Account Data
        console.log('Clicking Reset Account Data...');
        await resetBtn.click();
        await sleep(1200);

        // Confirm in Modal
        const confirmBtn = page.locator('#settings-confirm-reset-btn');
        await confirmBtn.waitFor({ state: 'visible', timeout: 10000 });
        console.log('Confirming Account Reset...');
        await confirmBtn.click();
        await sleep(2000);

        console.log('Waiting for redirection to Onboarding...');
        await page.waitForURL('**/onboard', { timeout: 25000 });
        await page.evaluate(() => {
            try {
                localStorage.removeItem('bb_checklist_pos');
                localStorage.removeItem('bb_checklist_dismissed');
            } catch {}
        });
        await sleep(2500);

        // ── 3. Derek AI Onboarding Interview (Profile 1: The Scrappy Beginner) ──
        console.log('3. Starting Onboarding Interview with Derek...');
        
        // Wait for Derek's greeting message
        await page.waitForSelector('div[class*="bubbleAi"]', { timeout: 30000 });
        console.log('Derek AI greeting received.');
        await sleep(3000);

        const answers = [
            "I want to start a newsletter for freelance graphic designers called 'Pixel Pushers', but it's just an idea right now. Literally zero revenue — haven't launched anything.",
            "My target audience is beginner freelance designers who struggle to get clients. I'm great at Figma and design work, but I suck at sales and writing, and freeze up trying to market myself.",
            "Assets: just my personal Instagram with ~300 friends. Time: 5 to 10 hours a week max. Budget: $50 a month max. Team: just me solo. Risk: conservative, I want to play it safe.",
            "That summarizes my idea and constraints! Let's build the strategy options.",
        ];

        for (let t = 0; t < answers.length; t++) {
            const takeaways = page.locator('div[class*="takeawaysCard"]');
            if (await takeaways.isVisible()) {
                console.log('Key takeaways already visible!');
                break;
            }

            console.log(`Sending Turn ${t + 1}: ${answers[t].substring(0, 45)}...`);
            const chatInput = page.locator('textarea[class*="chatInput"], textarea');
            await chatInput.waitFor({ state: 'visible', timeout: 15000 });
            await smoothType(page, 'textarea', answers[t], 20);
            await sleep(500);

            const sendBtn = page.locator('button[class*="sendButton"]');
            await sendBtn.click();
            await sleep(1500);

            console.log('Waiting for Derek reply or interview completion...');
            // Wait until loading indicator disappears and new assistant message or takeaways appear
            try {
                await page.waitForFunction(() => {
                    const loading = document.querySelector('div[class*="typingIndicator"]');
                    const takeaways = document.querySelector('div[class*="takeawaysCard"]');
                    const textareas = document.querySelector('textarea:not([disabled])');
                    return (!loading && textareas) || takeaways;
                }, { timeout: 60000 });
            } catch {
                // fallback sleep
                await sleep(5000);
            }
            await sleep(3500);

            if (await takeaways.isVisible()) {
                console.log('Key Takeaways card reached!');
                break;
            }
        }

        // Wait for Interview Complete & Takeaways Card
        const takeawaysCard = page.locator('div[class*="takeawaysCard"]');
        await takeawaysCard.waitFor({ state: 'visible', timeout: 30000 });
        await sleep(1500);

        // Scroll to Key Takeaways view
        console.log('Reviewing Key Takeaways...');
        await smoothScroll(page, 500, 800);
        await sleep(3500);

        // Click "Generate My Strategies"
        console.log('Submitting profile to generate strategies...');
        const generateStrategiesBtn = page.locator('button:has-text("Generate My Strategies")');
        await generateStrategiesBtn.click();
        await sleep(2500);

        // ── 4. Strategies Page ──
        console.log('4. Waiting for Strategies Page...');
        await page.waitForURL('**/strategies', { timeout: 15000 });
        await sleep(2000);

        // Wait for generation to complete if progress bar is active
        const strategyCards = page.locator('div[class*="strategyCard"]');
        await strategyCards.first().waitFor({ timeout: 60000 });
        console.log('3 Ranked Strategies loaded!');
        await sleep(2500);

        // Hover over score badges and explore strategies
        console.log('Showcasing Decision Scores and Strategy Paths...');
        const scoreBadges = page.locator('div[class*="score-badge"]');
        if (await scoreBadges.count() > 0) {
            await scoreBadges.first().hover();
            await sleep(2000);
        }

        await smoothScroll(page, 300, 800);
        await sleep(2000);

        if (await scoreBadges.count() > 1) {
            await scoreBadges.nth(1).hover();
            await sleep(2000);
        }

        await smoothScroll(page, 0, 800);
        await sleep(1500);

        // Pick Strategy (e.g. Choose Strategy on the first available card)
        console.log('Selecting Strategy Path...');
        const chooseBtn = page.locator('button:has-text("Choose This Strategy")').first();
        await chooseBtn.click();
        await sleep(2000);

        // ── 5. Commit / Execution Contract Page ──
        console.log('5. Onboarding to Commit Page...');
        await page.waitForURL('**/commit*', { timeout: 15000 });
        await sleep(2500);

        // Review Strategy visual and summary
        await smoothScroll(page, 350, 800);
        await sleep(2000);

        // Select / Confirm Locked KPI
        console.log('Configuring Locked KPI & Deliverable...');
        const kpiSelect = page.locator('select').first();
        if (await kpiSelect.isVisible()) {
            const options = await kpiSelect.locator('option').allInnerTexts();
            if (options.length > 1) {
                await kpiSelect.selectOption({ index: 1 });
                await sleep(1000);
            }
        }

        // Select Deliverable
        const deliverableSelect = page.locator('select').nth(1);
        if (await deliverableSelect.isVisible()) {
            const options = await deliverableSelect.locator('option').allInnerTexts();
            if (options.length > 1) {
                await deliverableSelect.selectOption({ index: 1 });
                await sleep(1000);
            }
        }

        // Adjust Calendar Blocks Slider
        const slider = page.locator('input[type="range"]');
        if (await slider.isVisible()) {
            await slider.fill('8');
            await sleep(1200);
        }

        // Check agreement box
        console.log('Accepting Execution Contract agreement...');
        const checkbox = page.locator('input[type="checkbox"]');
        await checkbox.check();
        await sleep(1500);

        // Lock Strategy
        console.log('Locking Strategy and generating action steps...');
        const lockBtn = page.locator('button:has-text("Lock Strategy")');
        await lockBtn.click();
        await sleep(3000);

        // ── 6. Dashboard & Daily Action Steps ──
        console.log('6. Navigating to Dashboard...');
        await page.waitForURL('**/dashboard', { timeout: 20000 });
        await sleep(3000);

        // Showcase Dashboard components
        console.log('Showcasing Active Strategy & Gantt chart...');
        await smoothScroll(page, 400, 1000);
        await sleep(3000);

        await smoothScroll(page, 800, 1000);
        await sleep(3000);

        await smoothScroll(page, 0, 1000);
        await sleep(2000);

        // Navigate to Ship Pack / Daily Tasks
        console.log('Navigating to Ship Pack / Action Steps...');
        await page.goto(`${BASE_URL}/ship-pack`, { waitUntil: 'networkidle' });
        await sleep(2500);

        // If tasks need generating, click Generate Tasks
        const genTasksBtn = page.locator('button:has-text("Generate Tasks")');
        if (await genTasksBtn.isVisible()) {
            console.log('Generating Day 1 tasks...');
            await genTasksBtn.click();
            await sleep(4000);
        }

        // Showcase task list with categories and time tags
        console.log('Showcasing Actionable Step-by-Step Tasks...');
        await smoothScroll(page, 300, 800);
        await sleep(3500);

        // Toggle first task to showcase interactivity
        const firstTaskCheck = page.locator('button[class*="taskCheck"]').first();
        if (await firstTaskCheck.isVisible()) {
            await firstTaskCheck.click();
            await sleep(2000);
        }

        // Final Outro view
        await smoothScroll(page, 0, 800);
        await sleep(4000);

        console.log('✨ Interaction complete! Finalizing video capture...');

    } catch (err) {
        console.error('Error during showcase interaction:', err);
    } finally {
        // Close page and context to flush video file
        const video = page.video();
        await page.close();
        await context.close();
        await browser.close();

        if (video) {
            const videoPath = await video.path();
            console.log(`Original video recorded at: ${videoPath}`);

            const outputMp4 = path.resolve(RECORDINGS_DIR, 'billionaire_brother_walkthrough_profile1.mp4');
            const artifactMp4 = path.resolve(ARTIFACTS_DIR, 'billionaire_brother_walkthrough_profile1.mp4');
            const workspaceMp4 = path.resolve(__dirname, '../billionaire_brother_walkthrough_profile1.mp4');

            console.log('Converting video to optimized MP4 with FFmpeg...');
            try {
                // Convert to high quality MP4
                execSync(`ffmpeg -y -i "${videoPath}" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -r 30 "${outputMp4}"`, { stdio: 'inherit' });
                console.log(`✅ MP4 Created: ${outputMp4}`);

                // Copy to workspace and brain artifacts
                fs.copyFileSync(outputMp4, workspaceMp4);
                console.log(`✅ Copied to Workspace: ${workspaceMp4}`);

                if (fs.existsSync(ARTIFACTS_DIR)) {
                    fs.copyFileSync(outputMp4, artifactMp4);
                    console.log(`✅ Copied to Brain Artifacts: ${artifactMp4}`);
                }
            } catch (ffmpegErr) {
                console.error('FFmpeg conversion error:', ffmpegErr);
            }
        }
    }
}

run();
