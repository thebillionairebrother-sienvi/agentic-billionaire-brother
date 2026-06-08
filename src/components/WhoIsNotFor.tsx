import { Check, X } from 'lucide-react';
import styles from './WhoIsNotFor.module.css';

export default function WhoIsNotFor() {
  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {/* Who it's FOR */}
        <div className={`${styles.card} ${styles.cardFor}`}>
          <h3 className={styles.cardTitle}>
            <span className={styles.iconWrapFor}><Check size={16} /></span>
            WHO IT IS FOR
          </h3>
          <ul className={styles.list}>
            <li>
              <strong>Bias-to-Action Founders:</strong> You want direct, unvarnished objectives and weekly checkboxes to hit.
            </li>
            <li>
              <strong>Sovereign Builders:</strong> You value numbers over theories and want a stress-tested reality check on your assumptions.
            </li>
            <li>
              <strong>Compounding Solopreneurs:</strong> You are sick of pivoting every 3 days and want to commit to a 4-week validation sequence.
            </li>
          </ul>
        </div>

        {/* Who it's NOT FOR */}
        <div className={`${styles.card} ${styles.cardNotFor}`}>
          <h3 className={styles.cardTitle}>
            <span className={styles.iconWrapNotFor}><X size={16} /></span>
            WHO IT IS NOT FOR
          </h3>
          <ul className={styles.list}>
            <li>
              <strong>Excuse Collectors:</strong> If you love explaining why things &quot;didn&apos;t work out&quot; instead of finding a workaround, do not sign up.
            </li>
            <li>
              <strong>Magic-Button Searchers:</strong> Derek is a strategist and accountability coach, not an automatic cash-generator. You still have to write the code and make the calls.
            </li>
            <li>
              <strong>Fragile Egos:</strong> Derek&apos;s audit feedback is quantitative and direct. If you need sugarcoating, hire a $5,000/mo agency consultant instead.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
