/**
 * Admin configuration and helpers.
 * Add admin emails to the ADMIN_EMAILS array.
 */

const ADMIN_EMAILS: string[] = [
    'teamsienvi@gmail.com',
];

export function isAdmin(email: string | undefined | null): boolean {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.toLowerCase());
}
