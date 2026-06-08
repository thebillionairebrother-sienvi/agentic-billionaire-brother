'use client';

import { useState } from 'react';
import { ShieldAlert, ShieldCheck, ArrowRight, CornerDownRight } from 'lucide-react';
import styles from './DecisionSimulator.module.css';

type DecisionData = {
  title: string;
  beforeScore: number;
  afterScore: number;
  brutalFeedback: string;
  refinedPlan: string[];
  verdict: string;
};

const DECISIONS: Record<string, DecisionData> = {
  ads: {
    title: 'Spend $5,000/mo on Paid Ads immediately',
    beforeScore: 28,
    afterScore: 84,
    brutalFeedback: 'You want to spend $5k/mo on ads, but you have no tracking set up, and your landing page converts at 0.8%. You are literally lighting cash on fire to buy traffic that leaks out of a bucket. Stop playing VC and fix the product first.',
    refinedPlan: [
      'Install post-purchase attribution and standard analytics tracking.',
      'Run a 5-user feedback test to identify why 99.2% of visitors leave.',
      'Run a micro-test: spend $250 on ads, identify landing page drop-off points, and hit 2.5% conversion baseline before scaling.',
    ],
    verdict: 'ATTRIBUTION LOCKED // METRIC-BASING BASELINE',
  },
  saas: {
    title: 'Pivot from $10k/mo consulting to a SaaS product',
    beforeScore: 38,
    afterScore: 82,
    brutalFeedback: 'Pivoting to SaaS because "consulting does not scale" is a classic excuse. You have zero code written, zero pre-sales, and no clear feature set. If you quit consulting today, you will run out of runway in 3 months and ship nothing.',
    refinedPlan: [
      'Keep consulting to fund development. Do not cut your active cash flow.',
      'Pre-sell the SaaS to 5 of your current consulting clients at a 50% lifetime discount.',
      'Build a no-code MVP or interactive mockup. Confirm they actually use it before hiring developers.',
    ],
    verdict: 'RUNWAY PRESERVED // PRE-SALE VALIDATION',
  },
  hiring: {
    title: 'Hire a Full-Time Developer to build features',
    beforeScore: 42,
    afterScore: 88,
    brutalFeedback: 'Hiring a $120k/yr developer to build features you "think" users want is how startups die. You are outsourcing your core validation. You do not need a full-time hire; you need product market fit.',
    refinedPlan: [
      'Document the exact user flows and feature specifications in a 2-page spec sheet.',
      'Hire a vetted contractor on a fixed-scope budget ($3,000 max) to build the core MVP.',
      'Do not hire full-time until the contractor-built MVP generates compounding revenue and you cannot keep up with support logs.',
    ],
    verdict: 'CONTRACT-BASED SHIP // RUNWAY CONSERVED',
  },
};

export default function DecisionSimulator() {
  const [activeTab, setActiveTab] = useState<keyof typeof DECISIONS>('ads');
  const data = DECISIONS[activeTab];

  return (
    <div className={styles.container}>
      {/* Selector Tabs */}
      <div className={styles.tabsList}>
        {Object.entries(DECISIONS).map(([key, item]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`${styles.tabBtn} ${activeTab === key ? styles.tabBtnActive : ''}`}
          >
            {item.title}
          </button>
        ))}
      </div>

      {/* Simulator Cards */}
      <div className={styles.grid}>
        {/* Left: Original Decision Audit */}
        <div className={`${styles.card} ${styles.cardBefore}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>ORIGINAL DECISION AUDIT</span>
            <span className={`${styles.statusBadge} ${styles.statusWeak}`}>
              <ShieldAlert size={12} /> WEAK
            </span>
          </div>

          <div className={styles.scoreContainer}>
            <span className={styles.scoreNum}>{data.beforeScore}</span>
            <span className={styles.scoreMax}>/100</span>
          </div>

          <div className={styles.feedbackSection}>
            <span className={styles.feedbackLabel}>DEREK&apos;S AUDIT FEEDBACK:</span>
            <p className={styles.feedbackText}>&quot;{data.brutalFeedback}&quot;</p>
          </div>
        </div>

        {/* Center Arrow */}
        <div className={styles.arrowContainer}>
          <div className={styles.arrowLine}>
            <ArrowRight size={20} className={styles.arrowIcon} />
          </div>
        </div>

        {/* Right: Derek's Brutal Optimization */}
        <div className={`${styles.card} ${styles.cardAfter}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>REFINED PROTOCOL</span>
            <span className={`${styles.statusBadge} ${styles.statusStrong}`}>
              <ShieldCheck size={12} /> OPTIMIZED
            </span>
          </div>

          <div className={styles.scoreContainer}>
            <span className={`${styles.scoreNum} ${styles.goldText}`}>{data.afterScore}</span>
            <span className={styles.scoreMax}>/100</span>
          </div>

          <div className={styles.planSection}>
            <span className={styles.feedbackLabel}>DEREK&apos;S DIRECTIVES:</span>
            <ul className={styles.directivesList}>
              {data.refinedPlan.map((step, idx) => (
                <li key={idx} className={styles.directiveItem}>
                  <CornerDownRight size={14} className={styles.bulletIcon} />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.verdictBar}>
            <span className={styles.verdictLabel}>SYSTEM VERDICT:</span>
            <span className={styles.verdictValue}>{data.verdict}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
