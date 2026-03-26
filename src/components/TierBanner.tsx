import { Crown, Users, User } from 'lucide-react';
import styles from './TierBanner.module.css';

interface TierBannerProps {
    tier: 'free' | 'brother' | 'team';
}

export function TierBanner({ tier }: TierBannerProps) {
    const isTeam = tier === 'team';
    const isBrother = tier === 'brother';
    
    return (
        <div className={`${styles.banner} ${isTeam ? styles.team : isBrother ? styles.brother : styles.free}`}>
            <div className={styles.content}>
                {isTeam ? <Users size={16} /> : isBrother ? <Crown size={16} /> : <User size={16} />}
                <span>
                    You are on the <strong>{isTeam ? 'Team' : isBrother ? 'Brother' : 'Free'}</strong> Tier
                </span>
                <span className={styles.badge}>
                    {isTeam ? 'Full Access' : isBrother ? 'Standard Access' : 'Limited Access'}
                </span>
            </div>
        </div>
    );
}
