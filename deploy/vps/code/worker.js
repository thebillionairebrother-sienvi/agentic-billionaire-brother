/**
 * ==============================================================================
 * Billionaire Brother — Edge Task Queue & Webhook Worker Daemon
 * Node: sienvi-edge-vps-01 (Hetzner Cloud cx23)
 * Standards: governance/VPS_DOCKER_CONTAINER_STANDARD.md
 * ==============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Worker, Queue } = require('bullmq');
const { createClient } = require('@supabase/supabase-js');
const { executeSprintPipeline } = require('./pipeline');

// Environment & Config
const PORT = process.env.PORT || 8088;
const REDIS_URL = process.env.REDIS_URL || 'redis://bb-redis:6379';
const WORKER_AUTH_TOKEN = process.env.WORKER_AUTH_TOKEN || 'bb-sienvi-edge-token-2026';
const CONCURRENCY = parseInt(process.env.CONCURRENCY_LIMIT || '2', 10);
const LOGS_DIR = process.env.LOGS_DIR || '/app/logs';

// Optional Supabase Client for direct state sync
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Structured Logger
function log(level, event, data = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        event,
        service: 'bb-edge-worker',
        ...data
    };
    const line = JSON.stringify(entry);
    console.log(line);

    // Append to logs volume if directory exists
    try {
        if (fs.existsSync(LOGS_DIR)) {
            fs.appendFileSync(path.join(LOGS_DIR, 'worker.log'), line + '\n', 'utf-8');
        }
    } catch (err) {
        // Fail open on log file write errors
    }
}

// ----------------------------------------------------------------------------
// 1. Task Queue & Worker (BullMQ)
// ----------------------------------------------------------------------------
const taskQueue = new Queue('bb-sprint-tasks', {
    connection: { url: REDIS_URL }
});

const worker = new Worker('bb-sprint-tasks', async (job) => {
    const { name, data } = job;
    log('info', 'JOB_PROCESSING_START', { job_id: job.id, task_name: name });

    if (name === 'GENERATE_SPRINT_PACK') {
        const result = await executeSprintPipeline(data);

        // Sync to Supabase if decision_id is provided
        if (supabase && data.decisionId) {
            try {
                await supabase
                    .from('decisions')
                    .update({
                        status: 'ready',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', data.decisionId);

                log('info', 'SUPABASE_SYNC_SUCCESS', { decision_id: data.decisionId });
            } catch (syncErr) {
                log('error', 'SUPABASE_SYNC_ERROR', { error: syncErr.message });
            }
        }

        return result;
    }

    throw new Error(`Unknown job task: ${name}`);
}, {
    connection: { url: REDIS_URL },
    concurrency: CONCURRENCY,
    limiter: {
        max: 10,       // Rule of 10 batch limit (Standard 4.C)
        duration: 60000 // per 60 seconds
    }
});

worker.on('completed', (job) => {
    log('info', 'JOB_COMPLETED', { job_id: job.id });
});

worker.on('failed', (job, err) => {
    log('error', 'JOB_FAILED', { job_id: job?.id, error: err.message });
});

// ----------------------------------------------------------------------------
// 2. HTTP Server (Health & Webhook Ingestion)
// ----------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
    const { method, url, headers } = req;

    // Healthcheck endpoint
    if (method === 'GET' && url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            status: 'healthy',
            uptime_seconds: process.uptime(),
            timestamp: new Date().toISOString(),
            concurrency: CONCURRENCY
        }));
    }

    // Webhook: Enqueue Sprint Generation Job
    if (method === 'POST' && url === '/webhook/job') {
        // Authenticate request
        const authHeader = headers['authorization'] || headers['x-worker-token'];
        if (!authHeader || (authHeader !== `Bearer ${WORKER_AUTH_TOKEN}` && authHeader !== WORKER_AUTH_TOKEN)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Unauthorized: invalid worker auth token' }));
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body);
                const jobId = payload.jobId || `job_${Date.now()}`;

                await taskQueue.add('GENERATE_SPRINT_PACK', {
                    jobId,
                    decisionId: payload.decisionId,
                    userProfile: payload.userProfile || {},
                    chosenStrategy: payload.chosenStrategy || {}
                }, {
                    attempts: 2,
                    backoff: { type: 'exponential', delay: 3000 }
                });

                log('info', 'JOB_ENQUEUED', { job_id: jobId });

                res.writeHead(202, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                    status: 'accepted',
                    job_id: jobId,
                    message: 'Billionaire Brother swarm job queued for execution'
                }));
            } catch (parseErr) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            }
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
    log('info', 'WORKER_SERVICE_STARTED', { port: PORT, concurrency: CONCURRENCY });
});

// ----------------------------------------------------------------------------
// 3. Graceful Shutdown
// ----------------------------------------------------------------------------
async function shutdown(signal) {
    log('info', 'WORKER_SHUTDOWN_SIGNAL', { signal });
    server.close();
    await worker.close();
    await taskQueue.close();
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
