import Link from 'next/link';
import { Crown, ArrowRight, Zap, Target, TrendingUp, Shield } from 'lucide-react';
import styles from './page.module.css';

export default function LandingPage() {
  return (
    <div className={styles.page}>
      {/* Nav */}
      <nav className={styles.nav}>
        <Link href="/" className={styles.navBrand}>
          <div className={styles.logoMark}>
            <Crown size={18} />
          </div>
          <span>The Billionaire Brother</span>
        </Link>
        <div className={styles.navActions}>
          <Link href="/testimonials" className="btn btn-ghost">
            Testimonials
          </Link>
          <Link href="/auth" className="btn btn-ghost">
            Sign In
          </Link>
          <Link href="/auth" className="btn btn-primary">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          <Zap size={14} />
          <span>AI-Powered Business Strategy</span>
        </div>
        <h1 className={styles.heroTitle}>
          3 Ranked Paths.
          <br />
          <span className={styles.heroGold}>One Choice.</span>
          <br />
          Weekly Shipping.
        </h1>
        <p className={styles.heroSub}>
          Your AI Billionaire Brother generates 3 ranked strategy archetypes with transparent
          Decision Scores. Pick one, commit, and get weekly Ship Packs with actionable
          deliverables — not fluff.
        </p>
        <div className={styles.heroCTA}>
          <Link href="/auth" className="btn btn-primary btn-lg">
            Start Free Questionnaire <ArrowRight size={18} />
          </Link>
          <span className={styles.heroNote}>10 minutes. Zero commitment.</span>
        </div>
      </section>

      {/* How it works */}
      <section className={styles.section}>
        <h2 className={`heading-lg ${styles.sectionTitle}`}>How It Works</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepNumber}>01</div>
            <h3 className="heading-sm">Questionnaire</h3>
            <p className="text-secondary">
              10-minute deep dive into your business, constraints, strengths, and goals.
            </p>
          </div>
          <div className={styles.stepArrow}>→</div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>02</div>
            <h3 className="heading-sm">3 Ranked Strategies</h3>
            <p className="text-secondary">
              AI generates 3 strategy archetypes with Decision Scores, risks, and KPIs.
            </p>
          </div>
          <div className={styles.stepArrow}>→</div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>03</div>
            <h3 className="heading-sm">Commit & Ship</h3>
            <p className="text-secondary">
              Pick one, lock your KPI, and get weekly Ship Packs with capped deliverables.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className={styles.section}>
        <div className={styles.featuresGrid}>
          <div className={`card ${styles.featureCard}`}>
            <Target size={24} className={styles.featureIcon} />
            <h3 className="heading-sm">Decision Scores</h3>
            <p className="text-secondary">
              Transparent 0–100 scoring across Market Fit, Resource Alignment, Speed to Revenue,
              Founder Fit, Risk Profile, and Scalability. Every score shows its math.
            </p>
          </div>
          <div className={`card ${styles.featureCard}`}>
            <TrendingUp size={24} className={styles.featureIcon} />
            <h3 className="heading-sm">Weekly Ship Packs</h3>
            <p className="text-secondary">
              2 big deliverables + 5 small tasks, each week. Capped to your hours-per-week budget.
              Never too much, never too vague.
            </p>
          </div>
          <div className={`card ${styles.featureCard}`}>
            <Shield size={24} className={styles.featureIcon} />
            <h3 className="heading-sm">Red Team QA</h3>
            <p className="text-secondary">
              Every AI output is adversarially reviewed before you see it. No unrealistic claims,
              no illegal advice, no missing assumptions.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className={styles.section}>
        <h2 className={`heading-lg ${styles.sectionTitle}`}>Simple Pricing</h2>
        <div className={styles.pricingCard}>
          <div className={styles.pricingBadge}>Founder Plan</div>
          <div className={styles.pricingPrice}>
            <span className={styles.priceCurrency}>$</span>
            <span className={styles.priceAmount}>79</span>
            <span className={styles.pricePeriod}>/mo</span>
          </div>
          <ul className={styles.pricingFeatures}>
            <li>✓ 3 ranked strategy archetypes</li>
            <li>✓ Decision Scores with full breakdown</li>
            <li>✓ Locked Strategy Brief</li>
            <li>✓ Weekly Ship Packs (2 big + 5 small)</li>
            <li>✓ Weekly Board Meetings (Kill/Keep/Double)</li>
            <li>✓ Red Team QA on all outputs</li>
            <li>✓ Cancel anytime</li>
          </ul>
          <Link href="/auth" className="btn btn-primary btn-lg" style={{ width: '100%' }}>
            Get Started <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Disclaimer */}
      <section className={styles.section}>
        <div className="disclaimer" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <span>⚠️</span>
          <span>
            Decision Scores are model-based estimates, not guarantees. They reflect pattern matching
            against stated inputs and documented assumptions. Results depend on execution quality and
            market conditions.
          </span>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p className="text-tertiary">
          © {new Date().getFullYear()} The Billionaire Brother. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
