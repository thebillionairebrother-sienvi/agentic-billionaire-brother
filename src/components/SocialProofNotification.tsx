'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck } from 'lucide-react';
import styles from './SocialProofNotification.module.css';

/* ══════════════════════════════════════════════
   Notification Data
   ══════════════════════════════════════════════ */

type NotificationType = 'purchase' | 'goal' | 'join' | 'result' | 'testimonial';

interface NotificationItem {
  type: NotificationType;
  message: string;
  icon: string;
  timestamp: string;
}

const NOTIFICATIONS: NotificationItem[] = [
  // Purchase
  {
    type: 'purchase',
    message: 'Ryan from Toronto just purchased the Billionaire Brother program.',
    icon: '💰',
    timestamp: '2 minutes ago',
  },
  {
    type: 'purchase',
    message: 'Andre from New York just enrolled in the Brother Plan.',
    icon: '💰',
    timestamp: '5 minutes ago',
  },
  {
    type: 'purchase',
    message: 'Jason from Miami just locked in the Team Plan.',
    icon: '💰',
    timestamp: '8 minutes ago',
  },
  {
    type: 'purchase',
    message: 'Kevin from Los Angeles just started his Billionaire Brother journey.',
    icon: '💰',
    timestamp: '12 minutes ago',
  },

  // Goal achieved
  {
    type: 'goal',
    message: 'David achieved his first major milestone within 90 days.',
    icon: '🏆',
    timestamp: '1 hour ago',
  },
  {
    type: 'goal',
    message: 'Marcus hit a Decision Score of 92 on his latest strategic move.',
    icon: '🏆',
    timestamp: '3 hours ago',
  },
  {
    type: 'goal',
    message: 'Tyler reached his 30-day execution streak — zero missed tasks.',
    icon: '🏆',
    timestamp: '4 hours ago',
  },
  {
    type: 'goal',
    message: 'Brandon completed all Red Team QA checks in under 48 hours.',
    icon: '🏆',
    timestamp: '6 hours ago',
  },

  // Joined community
  {
    type: 'join',
    message: 'Someone in London just joined the Billionaire Brother community.',
    icon: '👤',
    timestamp: '1 minute ago',
  },
  {
    type: 'join',
    message: 'Marcus from Atlanta started his Billionaire Brother journey today.',
    icon: '👤',
    timestamp: '3 minutes ago',
  },
  {
    type: 'join',
    message: 'A new member from Sydney just activated their strategy terminal.',
    icon: '👤',
    timestamp: '7 minutes ago',
  },
  {
    type: 'join',
    message: 'Someone from Berlin just joined the Billionaire Brother community.',
    icon: '👤',
    timestamp: '11 minutes ago',
  },

  // Positive result
  {
    type: 'result',
    message: 'A member from Dubai reported major progress after 3 months.',
    icon: '📈',
    timestamp: '2 hours ago',
  },
  {
    type: 'result',
    message: 'Ethan from Chicago saw a 3x improvement in his weekly execution score.',
    icon: '📈',
    timestamp: '5 hours ago',
  },
  {
    type: 'result',
    message: 'Jordan from Vancouver scaled his side project to consistent revenue using Derek\'s framework.',
    icon: '📈',
    timestamp: '8 hours ago',
  },
  {
    type: 'result',
    message: 'A member from Singapore eliminated 4 major bottlenecks with Red Team QA.',
    icon: '📈',
    timestamp: '1 day ago',
  },

  // Testimonial
  {
    type: 'testimonial',
    message: 'James says Billionaire Brother helped him stay focused and consistent.',
    icon: '⭐',
    timestamp: 'Verified Review',
  },
  {
    type: 'testimonial',
    message: 'Chris used Billionaire Brother to build better financial discipline.',
    icon: '⭐',
    timestamp: 'Verified Review',
  },
  {
    type: 'testimonial',
    message: '"Derek\'s brutal honesty is exactly what I needed to stop procrastinating." — Mike',
    icon: '⭐',
    timestamp: 'Verified Review',
  },
  {
    type: 'testimonial',
    message: '"The Revenue Velocity Machine changed how I approach every decision." — Daniel',
    icon: '⭐',
    timestamp: 'Verified Review',
  },
];

/* ══════════════════════════════════════════════
   Helper: random time between 15–20 seconds
   ══════════════════════════════════════════════ */
function randomInterval() {
  return Math.floor(Math.random() * 5000) + 15000; // 15 000–20 000ms
}

/** Random display duration between 5–7 seconds */
function randomDuration() {
  return Math.floor(Math.random() * 2000) + 5000; // 5 000–7 000ms
}

/** Map type → icon-bubble class */
const iconClass: Record<NotificationType, string> = {
  purchase: styles.iconPurchase,
  goal: styles.iconGoal,
  join: styles.iconJoin,
  result: styles.iconResult,
  testimonial: styles.iconTestimonial,
};

/* ══════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════ */

export default function SocialProofNotification() {
  const [current, setCurrent] = useState<NotificationItem | null>(null);
  const [phase, setPhase] = useState<'idle' | 'entering' | 'visible' | 'exiting'>('idle');
  const [dismissed, setDismissed] = useState(false);
  const [progress, setProgress] = useState(100);

  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const usedIndices = useRef<Set<number>>(new Set());
  const durationRef = useRef(6000);

  /** Pick a random notification we haven't shown recently */
  const pickNotification = useCallback(() => {
    if (usedIndices.current.size >= NOTIFICATIONS.length) {
      usedIndices.current.clear();
    }
    let idx: number;
    do {
      idx = Math.floor(Math.random() * NOTIFICATIONS.length);
    } while (usedIndices.current.has(idx));
    usedIndices.current.add(idx);
    return NOTIFICATIONS[idx];
  }, []);

  /** Show a notification */
  const showNotification = useCallback(() => {
    if (dismissed) return;

    const notif = pickNotification();
    const duration = randomDuration();
    durationRef.current = duration;

    setCurrent(notif);
    setProgress(100);
    setPhase('entering');

    // Start progress countdown
    const startTime = Date.now();
    progressTimer.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0 && progressTimer.current) {
        clearInterval(progressTimer.current);
      }
    }, 50);

    // Auto-hide after duration
    hideTimer.current = setTimeout(() => {
      setPhase('exiting');
      if (progressTimer.current) clearInterval(progressTimer.current);

      setTimeout(() => {
        setPhase('idle');
        setCurrent(null);
        // Schedule next
        showTimer.current = setTimeout(showNotification, randomInterval());
      }, 400); // exit animation duration
    }, duration);
  }, [dismissed, pickNotification]);

  /** Close button handler */
  const handleClose = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (progressTimer.current) clearInterval(progressTimer.current);
    setPhase('exiting');

    setTimeout(() => {
      setPhase('idle');
      setCurrent(null);
      // Schedule next even after manual close
      showTimer.current = setTimeout(showNotification, randomInterval());
    }, 350);
  }, [showNotification]);

  /** Permanently dismiss (optional — available for future use) */
  // const handleDismissPermanently = () => {
  //   setDismissed(true);
  //   handleClose();
  // };

  /** Lifecycle: kick off the first notification */
  useEffect(() => {
    // Initial delay: show first one after 8–12 seconds
    const initialDelay = Math.floor(Math.random() * 4000) + 8000;
    showTimer.current = setTimeout(showNotification, initialDelay);

    return () => {
      if (showTimer.current) clearTimeout(showTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (dismissed || !current || phase === 'idle') return null;

  const animClass =
    phase === 'entering' || phase === 'visible'
      ? styles.entering
      : phase === 'exiting'
        ? styles.exiting
        : '';

  return createPortal(
    <div className={styles.wrapper} id="social-proof-notification">
      <div className={`${styles.notification} ${animClass}`} role="status" aria-live="polite">
        {/* Icon */}
        <div className={`${styles.iconBubble} ${iconClass[current.type]}`}>
          {current.icon}
        </div>

        {/* Content */}
        <div className={styles.content}>
          <p className={styles.message}>{current.message}</p>
          <span className={styles.timestamp}>{current.timestamp}</span>
          <span className={styles.verifiedBadge}>
            <ShieldCheck />
            VERIFIED
          </span>
        </div>

        {/* Close */}
        <button
          className={styles.closeBtn}
          onClick={handleClose}
          aria-label="Dismiss notification"
          type="button"
        >
          <X />
        </button>

        {/* Progress bar */}
        <div
          className={styles.progressBar}
          style={{ width: `${progress}%`, transitionDuration: '50ms' }}
        />
      </div>
    </div>,
    document.body
  );
}
