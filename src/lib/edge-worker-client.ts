/**
 * ==============================================================================
 * Billionaire Brother — Edge Worker Dispatch Client
 * Bridges Next.js web application to the Hetzner Edge Worker (sienvi-edge-vps-01)
 * ==============================================================================
 */

export interface EdgeJobPayload {
    jobId: string;
    decisionId?: string;
    userProfile: Record<string, unknown>;
    chosenStrategy: Record<string, unknown>;
}

export interface EdgeJobResponse {
    success: boolean;
    status: string;
    job_id?: string;
    error?: string;
}

const EDGE_WORKER_URL = process.env.EDGE_WORKER_URL || 'http://2.28.32.45:8088';
const WORKER_AUTH_TOKEN = process.env.WORKER_AUTH_TOKEN || '';

/**
 * Dispatches a multi-agent sprint generation job to the Hetzner Edge Worker.
 */
export async function dispatchEdgeSprintJob(payload: EdgeJobPayload): Promise<EdgeJobResponse> {
    if (!EDGE_WORKER_URL) {
        console.warn('[EdgeWorkerClient] EDGE_WORKER_URL not configured. Skipping edge dispatch.');
        return {
            success: false,
            status: 'unconfigured',
            error: 'EDGE_WORKER_URL is not set'
        };
    }

    try {
        const response = await fetch(`${EDGE_WORKER_URL}/webhook/job`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${WORKER_AUTH_TOKEN}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[EdgeWorkerClient] Dispatch failed:', response.status, errorText);
            return {
                success: false,
                status: 'failed',
                error: `HTTP ${response.status}: ${errorText}`
            };
        }

        const data = await response.json();
        return {
            success: true,
            status: data.status || 'accepted',
            job_id: data.job_id
        };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[EdgeWorkerClient] Network error dispatching to edge worker:', message);
        return {
            success: false,
            status: 'error',
            error: message
        };
    }
}
