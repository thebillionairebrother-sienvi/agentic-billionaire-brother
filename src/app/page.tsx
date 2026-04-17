import Link from 'next/link';
import { Crown, ArrowRight, Zap, Target, TrendingUp, Shield, Check, Users } from 'lucide-react';
import styles from './page.module.css';
import RotatingMeme from '../components/RotatingMeme';
import RotatingTextBadge from '../components/RotatingTextBadge';

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
          <Link href="/framework" className="btn btn-ghost">
            How to use
          </Link>
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
        <div style={{ height: '225px', marginBottom: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <RotatingMeme />
        </div>
        <RotatingTextBadge className={styles.heroBadge} />
        <h1 className={styles.heroTitle}>
          Your Strategy.
          <br />
          <span className={styles.heroGold}>Your Action Steps.</span>
          <br />
          Built by Your Brother.
        </h1>
        <p className={styles.heroSub}>
          Meet Derek, your blunt, strategic, bullshit-cutting Billionaire Brother.
          He figures out where your money is getting stuck, builds the game plan,
          and gives you weekly Action Steps that keep you moving, shipping, and making real progress.
        </p>

        {/* VSL Placeholder */}
        <div className={styles.vslContainer}>
          <div className={styles.vslPlaceholder}>
            <div className={styles.playButton}>
              <div className={styles.playButtonTriangle}></div>
            </div>
            <p className={styles.vslText}>Video Placeholder</p>
          </div>
        </div>

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
            <h3 className="heading-sm">Strategy & KPIs</h3>
            <p className="text-secondary">
              Derek builds your strategy with Decision Scores, risks, and a locked KPI to track.
            </p>
          </div>
          <div className={styles.stepArrow}>→</div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>03</div>
            <h3 className="heading-sm">Execute & Ship</h3>
            <p className="text-secondary">
              Get weekly Action Steps with capped deliverables. Check in, adjust, repeat.
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
            <h3 className="heading-sm">Weekly Action Steps</h3>
            <p className="text-secondary">
              2 big deliverables + 5 small tasks, each week. Capped to your hours-per-week budget.
              Never too much, never too vague.
            </p>
          </div>
          <div className={`card ${styles.featureCard}`}>
            <Shield size={24} className={styles.featureIcon} />
            <h3 className="heading-sm">Red Team QA</h3>
            <p className="text-secondary">
              Every output is adversarially reviewed before you see it. No unrealistic claims,
              no illegal advice, no missing assumptions.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className={styles.section}>
        <h2 className={`heading-lg ${styles.sectionTitle}`}>Simple Pricing</h2>
        <div className={styles.pricingGrid}>

          {/* Free */}
          <div className={styles.pricingCard}>
            <div className={styles.pricingBadge}>Free</div>
            <div className={styles.pricingPrice}>
              <span className={styles.priceCurrency}>$</span>
              <span className={styles.priceAmount}>0</span>
              <span className={styles.pricePeriod}>/mo</span>
            </div>
            <ul className={styles.pricingFeatures}>
              <li><Check size={14} /> Strategy diagnosis</li>
              <li><Check size={14} /> Decision Scores</li>
              <li><Check size={14} /> 10 AI prompts / day</li>
              <li><Check size={14} /> Progress tracking</li>
              <li className={styles.featureLocked}><span className={styles.lockDash}>✕</span> Have Derek Do It</li>
              <li className={styles.featureLocked}><span className={styles.lockDash}>✕</span> Team seats</li>
            </ul>
            <Link href="/auth" className="btn btn-secondary" style={{ width: '100%' }}>
              Get Started Free
            </Link>
          </div>

          {/* Brother */}
          <div className={`${styles.pricingCard} ${styles.pricingCardFeatured}`}>
            <div className={`${styles.pricingBadge} ${styles.pricingBadgeFeatured}`}>Most Popular</div>
            <div className={styles.pricingPrice}>
              <span className={styles.priceCurrency}>$</span>
              <span className={styles.priceAmount}>99.99</span>
              <span className={styles.pricePeriod}>/mo</span>
            </div>
            <p className={styles.pricingPlanName}>Brother Plan</p>
            <ul className={styles.pricingFeatures}>
              <li><Check size={14} /> Strategy diagnosis</li>
              <li><Check size={14} /> Decision Scores</li>
              <li><Check size={14} /> 40 AI prompts / day</li>
              <li><Check size={14} /> Have Derek Do It</li>
              <li><Check size={14} /> AI deliverable downloads</li>
              <li className={styles.featureLocked}><span className={styles.lockDash}>✕</span> Team seats</li>
            </ul>
            <Link href="/auth" className="btn btn-primary btn-lg" style={{ width: '100%' }}>
              Get Started <ArrowRight size={18} />
            </Link>
          </div>

          {/* Team */}
          <div className={`${styles.pricingCard} ${styles.pricingCardTeam}`}>
            <div className={`${styles.pricingBadge} ${styles.pricingBadgeTeam}`}><Users size={12} /> Team</div>
            <div className={styles.pricingPrice}>
              <span className={styles.priceCurrency}>$</span>
              <span className={styles.priceAmount}>199</span>
              <span className={styles.pricePeriod}>/mo</span>
            </div>
            <p className={styles.pricingPlanName}>Team Plan</p>
            <ul className={styles.pricingFeatures}>
              <li><Check size={14} /> Strategy diagnosis</li>
              <li><Check size={14} /> Decision Scores</li>
              <li><Check size={14} /> 100 AI prompts / day</li>
              <li><Check size={14} /> Have Derek Do It</li>
              <li><Check size={14} /> AI deliverable downloads</li>
              <li><Check size={14} /> Team seats</li>
            </ul>
            <Link href="/auth" className="btn btn-secondary" style={{ width: '100%' }}>
              Get Team Access <ArrowRight size={18} />
            </Link>
          </div>

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
