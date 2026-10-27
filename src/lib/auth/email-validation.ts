const DOMAIN_TYPO_MAP: Record<string, string> = {
    // Hotmail / Outlook / Live
    'hotmali.com': 'hotmail.com',
    'hotmal.com': 'hotmail.com',
    'hotmai.com': 'hotmail.com',
    'htomail.com': 'hotmail.com',
    'homtail.com': 'hotmail.com',
    'hotamil.com': 'hotmail.com',
    'hotmail.co': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'outllok.com': 'outlook.com',
    'otulook.com': 'outlook.com',
    'outlook.co': 'outlook.com',
    // Gmail
    'gmial.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gnail.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'gmail.co': 'gmail.com',
    'gmail.con': 'gmail.com',
    // Yahoo
    'yaho.com': 'yahoo.com',
    'yahooo.com': 'yahoo.com',
    'yhoo.com': 'yahoo.com',
    'yahoo.co': 'yahoo.com',
    // iCloud
    'icoud.com': 'icloud.com',
    'iclod.com': 'icloud.com',
    'icloud.co': 'icloud.com',
};

export interface EmailTypoCheck {
    hasTypo: boolean;
    suggestedEmail?: string;
    originalDomain?: string;
    suggestedDomain?: string;
}

/**
 * Checks if an email address uses a common misspelled domain (e.g. hotmali.com, gamil.com).
 */
export function checkEmailDomainTypo(rawEmail: string): EmailTypoCheck {
    const trimmed = rawEmail.trim().toLowerCase();
    const atIndex = trimmed.lastIndexOf('@');
    if (atIndex <= 0 || atIndex === trimmed.length - 1) {
        return { hasTypo: false };
    }

    const localPart = trimmed.slice(0, atIndex);
    const domain = trimmed.slice(atIndex + 1);
    const suggestedDomain = DOMAIN_TYPO_MAP[domain];

    if (suggestedDomain) {
        return {
            hasTypo: true,
            originalDomain: domain,
            suggestedDomain,
            suggestedEmail: `${localPart}@${suggestedDomain}`,
        };
    }

    return { hasTypo: false };
}
