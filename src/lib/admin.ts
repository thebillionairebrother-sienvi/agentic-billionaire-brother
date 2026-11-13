/**
 * Admin configuration and helpers.
 *
 * "Admin mode" is a role, not a plan: admins get full (Team-level) access,
 * never see upgrade/trial offers, can't enrol in trials, are skipped by the
 * beta downgrade, and are never re-tiered by Stripe sync.
 *
 * An account is an admin if its email is listed here OR profiles.role = 'admin'.
 */

export const ADMIN_EMAILS: readonly string[] = [
    'teamsienvi@gmail.com',
    'spenceralmodiel@gmail.com',
    'scott@sienvi.com',
    'yourbro@thebillionairebrother.com',
    'info@sienvi.com',
];

export function isAdmin(email: string | undefined | null): boolean {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.toLowerCase());
}

/** Combines the email allowlist with the profiles.role flag. */
export function isAdminUser(email: string | undefined | null, role?: string | null): boolean {
    return isAdmin(email) || role === 'admin';
}
