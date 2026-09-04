import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { SendEmailCommandInput } from '@aws-sdk/client-ses';

export interface SesCredentials {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
}

export interface SesEmailPayload {
    from?: string;
    to: string | string[];
    replyTo?: string | string[];
    subject: string;
    html: string;
    text?: string;
    configurationSetName?: string;
}

export interface SesSendResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

export const DEFAULT_FROM_EMAIL =
    process.env.AWS_SES_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    'The Billionaire Brother <noreply@thebillionairebrother.com>';

let sesClient: SESClient | null = null;

/**
 * Returns an instance of SESClient configured via environment variables or custom credentials.
 */
export function getSesClient(creds?: SesCredentials): SESClient | null {
    if (!creds && sesClient) return sesClient;

    const region = creds?.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
    const accessKeyId = creds?.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = creds?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
        console.warn(
            '[AWS SES] AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY is not configured in environment variables.'
        );
        return null;
    }

    const client = new SESClient({
        region,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    });

    if (!creds) {
        sesClient = client;
    }

    return client;
}

/**
 * Retries SES operations when encountering throttling or rate limits.
 */
export async function executeSesWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 5,
    initialDelay = 1000
): Promise<T> {
    let delay = initialDelay;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err: unknown) {
            const error = err as { name?: string; message?: string };
            const errorName = error?.name || '';
            const message = error?.message || '';

            const isThrottled =
                errorName === 'ThrottlingException' ||
                errorName === 'TooManyRequestsException' ||
                errorName === 'LimitExceededException' ||
                errorName === 'RequestLimitExceeded' ||
                /throttl/i.test(message) ||
                /rate/i.test(message);

            if (isThrottled) {
                if (attempt === maxRetries) {
                    console.error(`[AWS SES] Rate limit reached after ${maxRetries} attempts.`);
                    throw err;
                }
                console.warn(`[AWS SES] Throttled. Retrying attempt ${attempt}/${maxRetries} in ${delay}ms...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
                delay *= 2;
                continue;
            }

            throw err;
        }
    }
    throw new Error('Maximum retries exceeded');
}

/**
 * Sends a single email via Amazon SES with automated retries.
 */
export async function sendEmail(
    payload: SesEmailPayload,
    creds?: SesCredentials
): Promise<SesSendResult> {
    const client = getSesClient(creds);
    if (!client) {
        return {
            success: false,
            error: 'AWS SES credentials not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY missing)',
        };
    }

    const toAddresses = Array.isArray(payload.to) ? payload.to : [payload.to];
    const fromAddress = payload.from || DEFAULT_FROM_EMAIL;
    const replyToAddresses = payload.replyTo
        ? Array.isArray(payload.replyTo)
            ? payload.replyTo
            : [payload.replyTo]
        : undefined;

    const configurationSetName =
        payload.configurationSetName || process.env.AWS_SES_CONFIGURATION_SET || undefined;

    const textBody =
        payload.text ||
        payload.html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    const input: SendEmailCommandInput = {
        Source: fromAddress,
        Destination: {
            ToAddresses: toAddresses,
        },
        Message: {
            Subject: {
                Data: payload.subject,
                Charset: 'UTF-8',
            },
            Body: {
                Html: {
                    Data: payload.html,
                    Charset: 'UTF-8',
                },
                Text: {
                    Data: textBody,
                    Charset: 'UTF-8',
                },
            },
        },
        ReplyToAddresses: replyToAddresses,
        ConfigurationSetName: configurationSetName,
    };

    try {
        const command = new SendEmailCommand(input);
        const response = await executeSesWithRetry(() => client.send(command));
        return {
            success: true,
            messageId: response.MessageId,
        };
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[AWS SES] Error sending email:', errorMessage);
        return {
            success: false,
            error: errorMessage,
        };
    }
}

/**
 * Sends a batch of emails respecting AWS SES rate limits (default 14 emails / sec).
 */
export async function sendBatchEmails(
    payloads: SesEmailPayload[],
    maxRatePerSecond = 14,
    creds?: SesCredentials
): Promise<SesSendResult[]> {
    const results: SesSendResult[] = [];
    const delayBetweenItems = Math.ceil(1000 / maxRatePerSecond);

    console.log(`[AWS SES] Starting batch send of ${payloads.length} emails (rate cap: ${maxRatePerSecond}/sec)...`);

    for (let i = 0; i < payloads.length; i++) {
        const result = await sendEmail(payloads[i], creds);
        results.push(result);

        if (i < payloads.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, delayBetweenItems));
        }
    }

    return results;
}
