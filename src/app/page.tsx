'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Crown, ArrowRight, Target, TrendingUp, Shield, Check, Users, Terminal, ChevronRight, X, Star, Quote } from 'lucide-react';
import styles from './page.module.css';
import { useEffect, useState, useRef } from 'react';
import { motion, useScroll, useTransform, useMotionValue, useSpring, Variants } from 'framer-motion';
import SocialProofNotification from '@/components/SocialProofNotification';
import DecisionSimulator from '@/components/DecisionSimulator';
import WhoIsNotFor from '@/components/WhoIsNotFor';
import OnboardingClarity from '@/components/OnboardingClarity';
import VslPlayer from '@/components/VslPlayer';

/* ── 3D Tilt Wrapper Animation ── */
function TiltWrapper({ children }: { children: React.ReactNode }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["8deg", "-8deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-8deg", "8deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div style={{ perspective: 1200, display: 'flex', width: '100%' }}>
      <motion.div
        style={{ rotateX, rotateY, width: '100%', display: 'flex', flexDirection: 'column' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </motion.div>
    </div>
  );
}

/* ── Terminal typing animation data ── */
type TerminalSegment = { text: string; className?: string };
type TerminalLineData =
  | { type: 'command'; segments: TerminalSegment[] }
  | { type: 'blank' }
  | { type: 'plain'; segments: TerminalSegment[] };

const TERMINAL_LINES: TerminalLineData[] = [
  {
    type: 'command',
    segments: [{ text: ' Analysing current trajectory...' }],
  },
  {
    type: 'command',
    segments: [
      { text: ' Efficiency score: ' },
      { text: '34%', className: styles.terminalHighlight },
    ],
  },
  {
    type: 'command',
    segments: [
      { text: ' Major bottleneck identified: ' },
      { text: 'Indecision.', className: styles.terminalWarn },
    ],
  },
  { type: 'blank' },
  {
    type: 'plain',
    segments: [{ text: 'Generating brutal action plan.', className: styles.terminalMuted }],
  },
];

const CHAR_DELAY = 38;   // ms per character
const LINE_PAUSE = 320;  // ms pause after each line finishes before starting the next
const LOOP_PAUSE = 2200; // ms pause before restarting the animation

function useTerminalAnimation() {
  const [visibleLines, setVisibleLines] = useState<number>(0);      // how many lines are fully visible
  const [typingText, setTypingText] = useState<string>('');          // current partially-typed line text
  const [showCursor, setShowCursor] = useState<boolean>(true);
  const lineRef = useRef(0);    // which line we're currently typing
  const charRef = useRef(0);    // which character in that line's full text we're at
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Extract the plain-text version of a line for typing
  function getPlainText(line: TerminalLineData): string {
    if (line.type === 'blank') return '';
    return line.segments.map((s) => s.text).join('');
  }

  useEffect(() => {
    function scheduleNext() {
      const line = TERMINAL_LINES[lineRef.current];
      if (!line) return;

      const fullText = getPlainText(line);

      if (line.type === 'blank') {
        // blank line — just commit it without typing
        timerRef.current = setTimeout(() => {
          setVisibleLines((n) => n + 1);
          lineRef.current += 1;
          charRef.current = 0;
          setTypingText('');

          if (lineRef.current < TERMINAL_LINES.length) {
            timerRef.current = setTimeout(scheduleNext, LINE_PAUSE);
          } else {
            // Finished — loop
            timerRef.current = setTimeout(restart, LOOP_PAUSE);
          }
        }, LINE_PAUSE / 2);
        return;
      }

      if (charRef.current <= fullText.length) {
        setTypingText(fullText.slice(0, charRef.current));
        charRef.current += 1;
        timerRef.current = setTimeout(scheduleNext, CHAR_DELAY);
      } else {
        // Done typing this line — commit it
        timerRef.current = setTimeout(() => {
          setVisibleLines((n) => n + 1);
          lineRef.current += 1;
          charRef.current = 0;
          setTypingText('');

          if (lineRef.current < TERMINAL_LINES.length) {
            timerRef.current = setTimeout(scheduleNext, LINE_PAUSE);
          } else {
            timerRef.current = setTimeout(restart, LOOP_PAUSE);
          }
        }, LINE_PAUSE);
      }
    }

    function restart() {
      lineRef.current = 0;
      charRef.current = 0;
      setVisibleLines(0);
      setTypingText('');
      timerRef.current = setTimeout(scheduleNext, 600);
    }

    timerRef.current = setTimeout(scheduleNext, 800);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Blinking cursor ticker
  useEffect(() => {
    const id = setInterval(() => setShowCursor((v) => !v), 530);
    return () => clearInterval(id);
  }, []);

  return { visibleLines, typingText, showCursor };
}

/* ── Render a committed (fully-typed) terminal line ── */
function CommittedLine({ line }: { line: TerminalLineData }) {
  if (line.type === 'blank') return <p className={styles.terminalLine}>&nbsp;</p>;

  return (
    <p className={styles.terminalLine}>
      {line.type === 'command' && (
        <span className={styles.terminalPrompt}>&gt;</span>
      )}
      {line.segments.map((seg, i) =>
        seg.className ? (
          <span key={i} className={seg.className}>{seg.text}</span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </p>
  );
}

/* ── Animated terminal that renders committed lines + the currently-typing line ── */
function AnimatedTerminal() {
  const { visibleLines, typingText, showCursor } = useTerminalAnimation();
  const currentLine = TERMINAL_LINES[visibleLines];
  const isTyping = visibleLines < TERMINAL_LINES.length;

  return (
    <div className={styles.terminalBody}>
      {/* Committed lines */}
      {TERMINAL_LINES.slice(0, visibleLines).map((line, i) => (
        <CommittedLine key={i} line={line} />
      ))}

      {/* Currently typing line */}
      {isTyping && currentLine && currentLine.type !== 'blank' && (
        <p className={styles.terminalLine}>
          {currentLine.type === 'command' && (
            <span className={styles.terminalPrompt}>&gt;</span>
          )}
          {/* Render typed segments with colour split */}
          {(() => {
            let remaining = typingText;
            return currentLine.segments.map((seg, i) => {
              if (remaining.length === 0) return null;
              const chunk = remaining.slice(0, seg.text.length);
              remaining = remaining.slice(seg.text.length);
              return seg.className ? (
                <span key={i} className={seg.className}>{chunk}</span>
              ) : (
                <span key={i}>{chunk}</span>
              );
            });
          })()}
          <span className={`${styles.terminalCursor} ${showCursor ? styles.cursorVisible : styles.cursorHidden}`}>▌</span>
        </p>
      )}

      {/* Idle cursor after all lines are done */}
      {!isTyping && (
        <p className={styles.terminalLine}>
          <span className={`${styles.terminalCursor} ${showCursor ? styles.cursorVisible : styles.cursorHidden}`}>▌</span>
        </p>
      )}
    </div>
  );
}

/* ── Staggered Reveal Variants ── */
const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const fadeUpVariant: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' }
  }
};

/* ── Meme Carousel (Temporary) ── */
function MemeCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const memes = [
    '/memes/meme1.jpg',
    '/memes/meme2.jpg',
    '/memes/meme3.gif',
    '/memes/meme4.gif',
    '/memes/meme5.jpg',
    '/memes/meme6.jpg',
    '/memes/meme7.jpg',
    '/memes/meme8.jpg',
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % memes.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '380px', height: '100%', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 215, 0, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      {memes.map((src, index) => (
        <motion.div
          key={src}
          initial={false}
          animate={{ opacity: index === currentIndex ? 1 : 0 }}
          transition={{ duration: 0.5 }}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: index === currentIndex ? 'auto' : 'none' }}
        >
          <Image src={src} alt={`Meme ${index + 1}`} fill style={{ objectFit: 'contain', padding: '16px' }} unoptimized={src.endsWith('.gif')} />
        </motion.div>
      ))}
    </div>
  );
}

export default function LandingPage() {
  const heroRef = useRef(null);
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });

  const heroYLeft = useTransform(heroScroll, [0, 1], ["0%", "40%"]);
  const heroYRight = useTransform(heroScroll, [0, 1], ["0%", "70%"]);
  const heroOpacity = useTransform(heroScroll, [0, 0.8, 1], [1, 0, 0]);

  return (
    <main id="main-content" className={styles.page}>
      <SocialProofNotification />

      {/* ── Nav ── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.navBrand}>
            <div className={styles.logoMark}>
              <Crown size={16} />
            </div>
            <span className={styles.navBrandText}>THE BILLIONAIRE BROTHER</span>
          </Link>
          <div className={styles.navLinks}>
            <Link href="/guide" className={styles.navLink}>PLAYBOOK</Link>
            <Link href="/testimonials" className={styles.navLink}>TESTIMONIALS</Link>
            <Link href="/#pricing" className={styles.navLink}>PRICING</Link>
            <Link href="/#features" className={styles.navLink}>FEATURES</Link>
          </div>
          <Link href="/auth" className={styles.navCta}>
            ACCESS TERMINAL →
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={styles.hero} ref={heroRef}>
        <motion.div
          className={styles.heroInner}
          style={{ opacity: heroOpacity }}
        >
          {/* Left: headline block */}
          <motion.div className={styles.heroLeft} style={{ y: heroYLeft }}>
            <div className={styles.systemChip}>
              <span className={styles.chipDot} />
              <span>SYSTEM ONLINE // DEREK_V2.0</span>
            </div>

            <h1 className={styles.heroTitle}>
              Your Strategy.<br />
              <span className={styles.strikethrough}>Your Excuses.</span><br />
              <span className={styles.heroGold}>Built by Your<br />Bro.</span>
            </h1>

            <p className={styles.heroSub}>
              Derek isn&apos;t here to be your friend. He&apos;s a blunt, strategic AI billionaire
              designed to audit your decisions, ruthlessly optimize your workflow, and
              force you to ship via the BILLIONAIRE BROTHER&apos;S REVENUE VELOCITY MACHINE&trade;. No fluff. Just metrics and execution.
            </p>

            <div className={styles.heroCTA}>
              <Link href="/auth" className={styles.ctaPrimary} id="hero-cta">
                START FREE QUESTIONNAIRE →
              </Link>
            </div>
          </motion.div>

          {/* Right: terminal card */}
          <motion.div className={styles.heroRight} style={{ y: heroYRight }}>
            {/* <div className={styles.terminalCard}>
              <div className={styles.terminalBar}>
                <div className={styles.terminalDots}>
                  <span className={styles.dot} style={{ background: '#ff5f56' }} />
                  <span className={styles.dot} style={{ background: '#ffbd2e' }} />
                  <span className={styles.dot} style={{ background: '#27c93f' }} />
                </div>
                <span className={styles.terminalTitle}>derek_terminal.sh</span>
              </div>
              <AnimatedTerminal />
            </div> */}
            <MemeCarousel />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Video Sales Letter (VSL) ── */}
      <section className={styles.vslSection}>
        <VslPlayer
          videoId="93z_nUCGTRo"
          badgeText="Strategic Overview"
          badgeIcon={<Terminal size={14} />}
          title="Build a Legacy"
          subtitle="With Your Bare Hands"
        />
      </section>

      {/* ── How It Works ── */}
      <section className={styles.howItWorks}>
        <motion.div
          className={styles.sectionInner}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, margin: "-100px" }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className={styles.sectionMeta}>
            <span className={styles.sectionLabel}>THE PROTOCOL</span>
            <h2 className={styles.sectionTitle}>How It Works</h2>
            <p className={styles.sectionTagline}>
              A systematic dismantling of your comfort zone. Execute the steps, or get left behind.
            </p>
          </div>

          <motion.div
            className={styles.stepsGrid}
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "-100px" }}
          >
            <motion.div className={styles.stepCard} variants={fadeUpVariant}>
              <div className={styles.stepIconRow}>
                <Target size={36} className={styles.stepIcon} />
                <span className={styles.stepNum}>01</span>
              </div>
              <h3 className={styles.stepTitle}>Questionnaire</h3>
              <p className={styles.stepBody}>
                Submit your current status. Derek processes your inputs to establish a
                baseline of your operational efficiency and glaring weaknesses.
              </p>
            </motion.div>
            <motion.div className={styles.stepCard} variants={fadeUpVariant}>
              <div className={styles.stepIconRow}>
                <TrendingUp size={36} className={styles.stepIcon} />
                <span className={styles.stepNum}>02</span>
              </div>
              <h3 className={styles.stepTitle}>Strategy &amp; KPIs</h3>
              <p className={styles.stepBody}>
                Receive a bespoke, unvarnished strategy. Key Performance Indicators are
                locked in. There is no room for interpretation.
              </p>
            </motion.div>
            <motion.div className={styles.stepCard} variants={fadeUpVariant}>
              <div className={styles.stepIconRow}>
                <ChevronRight size={36} className={styles.stepIcon} />
                <span className={styles.stepNum}>03</span>
              </div>
              <h3 className={styles.stepTitle}>Execute &amp; Ship</h3>
              <p className={styles.stepBody}>
                The mandate is execution. Follow the weekly directives. Report back. If you
                fail, Derek will ensure you know exactly why.
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Onboarding Pipeline ── */}
      <section className={styles.onboardingSection}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionMetaCenter}>
            <span className={styles.sectionLabel}>ONBOARDING CADENCE</span>
            <h2 className={styles.sectionTitleLg}>What Happens After You Join?</h2>
            <p className={styles.sectionTaglineCenter}>
              A structured roadmap from your initial assessment to your weekly board review cycles.
            </p>
          </div>
          <OnboardingClarity />
        </div>
      </section>

      {/* ── Features / Arsenal ── */}
      <section className={styles.arsenal} id="features">
        <motion.div
          className={styles.sectionInner}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, margin: "-100px" }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className={styles.sectionMeta}>
            <span className={styles.sectionLabel}>THE ARSENAL</span>
            <h2 className={styles.sectionTitle}>Tools for Unapologetic<br />Growth.</h2>
          </div>

          <motion.div
            className={styles.arsenalGrid}
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "-100px" }}
          >
            {/* Decision Scores — large card */}
            <motion.div className={styles.arsenalCardLg} variants={fadeUpVariant}>
              <Target size={20} className={styles.arsenalIcon} />
              <h3 className={styles.arsenalTitle}>Decision Scores</h3>
              <p className={styles.arsenalBody}>
                Every choice you make is quantified. Derek evaluates your strategic moves
                on a scale of 0 to 100. Ship guessing; start optimizing based on cold, hard data.
              </p>
              <div className={styles.scoreChip}>
                <span className={styles.scoreLabel}>Last Decision: [Pivot to SaaS]</span>
                <span className={styles.scoreValue}>SCORE: 42/100 <span className={styles.scoreBad}>[WEAK]</span></span>
              </div>
            </motion.div>

            {/* Weekly Action Steps */}
            <motion.div className={styles.arsenalCardSm} variants={fadeUpVariant}>
              <TrendingUp size={20} className={styles.arsenalIcon} />
              <h3 className={styles.arsenalTitle}>Weekly Action Steps</h3>
              <p className={styles.arsenalBody}>
                Bite-sized, uncompromising directives issued every Monday. No broad theories.
                Only actionable commands.
              </p>
            </motion.div>

            {/* Red Team QA */}
            <motion.div className={styles.arsenalCardSm} variants={fadeUpVariant}>
              <Shield size={20} className={styles.arsenalIcon} />
              <h3 className={styles.arsenalTitle}>Red Team QA</h3>
              <p className={styles.arsenalBody}>
                Before you launch, Derek stress-tests your idea. Finding vulnerabilities before
                the market does.
              </p>
            </motion.div>

            {/* System Architecture image-card */}
            <motion.div className={styles.arsenalImageCard} variants={fadeUpVariant}>
              <Image src="/images/strategies/strategy-growth.png" alt="Strategy Growth" fill style={{ objectFit: 'cover' }} />
              <div className={styles.arsenalImageOverlay}>
                <span className={styles.arsenalImageLabel}>System Architecture</span>
                <span className={styles.arsenalSecureBadge}>SECURE</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Interactive Decision Simulator Widget */}
          <motion.div className={styles.simulatorWrapper} variants={fadeUpVariant}>
            <h3 className={styles.simulatorHeader}>Stress-Test Your Strategy</h3>
            <p className={styles.simulatorDesc}>
              Select a standard business decision below to see how Derek audits and refines the execution logic.
            </p>
            <DecisionSimulator />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Audience Fit ── */}
      <section className={styles.audienceFit}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionMetaCenter}>
            <span className={styles.sectionLabel}>AUDIENCE SELECTION</span>
            <h2 className={styles.sectionTitleLg}>Who This Is Not For</h2>
            <p className={styles.sectionTaglineCenter}>
              We filter out the talkers to protect the execution velocity of our builders.
            </p>
          </div>
          <WhoIsNotFor />
        </div>
      </section>

      {/* ── Testimonial Showcase ── */}
      <section className={styles.testimonialsShowcase}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionMetaCenter}>
            <span className={styles.sectionLabel}>PROOF IN ACTION</span>
            <h2 className={styles.sectionTitleLg}>Bet On Yourself</h2>
            <p className={styles.sectionTaglineCenter}>
              Hear from founders who stopped making excuses, locked in their strategy, and started shipping.
            </p>
          </div>
          
          <div className={styles.testimonialShowcaseGrid}>
            <div className={styles.showcaseCard}>
              <div className={styles.quoteIconRow}>
                <Quote className={styles.quoteIcon} size={18} />
                <div className={styles.stars}>
                  <Star size={12} fill="var(--gold-400)" color="var(--gold-400)" />
                  <Star size={12} fill="var(--gold-400)" color="var(--gold-400)" />
                  <Star size={12} fill="var(--gold-400)" color="var(--gold-400)" />
                  <Star size={12} fill="var(--gold-400)" color="var(--gold-400)" />
                  <Star size={12} fill="var(--gold-400)" color="var(--gold-400)" />
                </div>
              </div>
              <p className={styles.showcaseQuote}>
                "Derek called out every excuse I was making and gave me a real plan. Within 2 weeks, I went from spinning my wheels to actually shipping."
              </p>
              <div className={styles.showcaseAuthor}>
                <div className={styles.authorBadge}>M</div>
                <div>
                  <span className={styles.authorName}>Marcus T.</span>
                  <span className={styles.authorRole}>E-commerce Founder</span>
                </div>
              </div>
            </div>

            <div className={styles.showcaseCard}>
              <div className={styles.quoteIconRow}>
                <Quote className={styles.quoteIcon} size={18} />
                <div className={styles.stars}>
                  <Star size={12} fill="var(--gold-400)" color="var(--gold-400)" />
                  <Star size={12} fill="var(--gold-400)" color="var(--gold-400)" />
                  <Star size={12} fill="var(--gold-400)" color="var(--gold-400)" />
                  <Star size={12} fill="var(--gold-400)" color="var(--gold-400)" />
                  <Star size={12} fill="var(--gold-400)" color="var(--gold-400)" />
                </div>
              </div>
              <p className={styles.showcaseQuote}>
                "I was drowning in ideas and couldn't commit. The Decision Scores made it crystal clear which path had the highest success probability."
              </p>
              <div className={styles.showcaseAuthor}>
                <div className={styles.authorBadge} style={{ background: 'var(--accent-blue)' }}>S</div>
                <div>
                  <span className={styles.authorName}>Sarah K.</span>
                  <span className={styles.authorRole}>SaaS Startup Founder</span>
                </div>
              </div>
            </div>

            <div className={styles.showcaseCard}>
              <div className={styles.quoteIconRow}>
                <Quote className={styles.quoteIcon} size={18} />
                <div className={styles.stars}>
                  <Star size={12} fill="var(--gold-400)" color="var(--gold-400)" />
                  <Star size={12} fill="var(--gold-400)" color="var(--gold-400)" />
                  <Star size={12} fill="var(--gold-400)" color="var(--gold-400)" />
                  <Star size={12} fill="var(--gold-400)" color="var(--gold-400)" />
                  <Star size={12} fill="var(--gold-400)" color="var(--gold-400)" />
                </div>
              </div>
              <p className={styles.showcaseQuote}>
                "Derek doesn't sugarcoat anything. He told me my first idea was trash, explained exactly why, and helped me pivot to $10K/mo in 3 months."
              </p>
              <div className={styles.showcaseAuthor}>
                <div className={styles.authorBadge} style={{ background: 'var(--accent-green)' }}>J</div>
                <div>
                  <span className={styles.authorName}>James L.</span>
                  <span className={styles.authorRole}>Agency Owner</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-8)' }}>
            <Link href="/testimonials" className={styles.testimonialsLink}>
              See More Founder Outcomes →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className={styles.pricing} id="pricing">
        <motion.div
          className={styles.sectionInner}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, margin: "-100px" }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className={styles.sectionMetaCenter}>
            <span className={styles.sectionLabel}>ACCESS TIERS</span>
            <h2 className={styles.sectionTitleLg}>Invest in Discipline.</h2>
            <p className={styles.sectionPricingSub}>14-day money-back guarantee. Self-service cancel in 1 click.</p>
            <div className={styles.pricingUrgencyBanner}>
              <span className={styles.pricingUrgencyDot} />
              <span>LAUNCH PRICING — Limited spots at these rates. Lock in before the price increases.</span>
            </div>
          </div>

          <motion.div
            className={styles.pricingGrid}
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: "-100px" }}
          >
            {/* Free */}
            <motion.div variants={fadeUpVariant}>
              <TiltWrapper>
                <div className={styles.pricingCard}>
                  <div className={styles.pricingTierLabel}>FREE</div>
                  <div className={styles.pricingTierPurpose}>For validating initial ideas</div>
                  <div className={styles.pricingPrice}>
                    <span className={styles.priceCurrency}>$</span>
                    <span className={styles.priceAmount}>0</span>
                  </div>
                  <ul className={styles.pricingFeatures}>
                    <li><Check size={13} className={styles.checkIcon} /> Strategy diagnosis</li>
                    <li><Check size={13} className={styles.checkIcon} /> Decision Scores</li>
                    <li><Check size={13} className={styles.checkIcon} /> 10 AI prompts / day</li>
                    <li><Check size={13} className={styles.checkIcon} /> Progress tracking</li>
                    <li className={styles.mutedFeature}><X size={13} className={styles.xIcon} /> Have Derek Do It</li>
                    <li className={styles.mutedFeature}><X size={13} className={styles.xIcon} /> Team Seats</li>
                  </ul>
                  <Link href="/auth" className={styles.btnSecondary} id="pricing-free-cta">
                    BEGIN BASIC
                  </Link>
                </div>
              </TiltWrapper>
            </motion.div>

            {/* Brother — featured */}
            <motion.div variants={fadeUpVariant}>
              <TiltWrapper>
                <div className={`${styles.pricingCard} ${styles.pricingCardFeatured}`}>
                  <div className={styles.mostPopularBadge}>MOST POPULAR</div>
                  <div className={styles.pricingTierLabel}>BROTHER PLAN</div>
                  <div className={styles.pricingTierPurpose}>For solopreneurs &amp; operators</div>
                  <div className={styles.pricingPrice}>
                    <div className={styles.priceStack}>
                      <div className={styles.priceOriginalRow}>
                        <span className={styles.priceOriginal}>$49</span>
                        <span className={styles.discountBadge}>20% OFF</span>
                      </div>
                      <div className={styles.priceCurrentRow}>
                        <span className={styles.priceCurrency}>$</span>
                        <span className={styles.priceAmount}>39</span>
                        <span className={styles.pricePeriod}>/mo</span>
                      </div>
                    </div>
                  </div>
                  <ul className={styles.pricingFeatures}>
                    <li><Check size={13} className={styles.checkIconGold} /> Strategy diagnosis</li>
                    <li><Check size={13} className={styles.checkIconGold} /> Decision Scores</li>
                    <li><Check size={13} className={styles.checkIconGold} /> 40 AI prompts / day</li>
                    <li><Check size={13} className={styles.checkIconGold} /> Progress tracking</li>
                    <li><Check size={13} className={styles.checkIconGold} /> Have Derek Do It</li>
                    <li><Check size={13} className={styles.checkIconGold} /> AI deliverable downloads</li>
                    <li className={styles.mutedFeature}><X size={13} className={styles.xIcon} /> Team Seats</li>
                  </ul>
                  <Link href="/auth" className={styles.btnPrimary} id="pricing-brother-cta">
                    DEPLOY BROTHER
                  </Link>
                </div>
              </TiltWrapper>
            </motion.div>

            {/* Team */}
            <motion.div variants={fadeUpVariant}>
              <TiltWrapper>
                <div className={styles.pricingCard}>
                  <div className={styles.pricingTierLabel}>TEAM PLAN</div>
                  <div className={styles.pricingTierPurpose}>For small product &amp; SaaS teams</div>
                  <div className={styles.pricingPrice}>
                    <div className={styles.priceStack}>
                      <div className={styles.priceOriginalRow}>
                        <span className={styles.priceOriginal}>$199</span>
                        <span className={styles.discountBadgeBlue}>35% OFF</span>
                      </div>
                      <div className={styles.priceCurrentRow}>
                        <span className={styles.priceCurrency}>$</span>
                        <span className={styles.priceAmount}>129</span>
                        <span className={styles.pricePeriod}>/mo</span>
                      </div>
                    </div>
                  </div>
                  <ul className={styles.pricingFeatures}>
                    <li><Check size={13} className={styles.checkIcon} /> Strategy diagnosis</li>
                    <li><Check size={13} className={styles.checkIcon} /> Decision Scores</li>
                    <li><Check size={13} className={styles.checkIcon} /> 100 AI prompts / day</li>
                    <li><Check size={13} className={styles.checkIcon} /> Progress tracking</li>
                    <li><Check size={13} className={styles.checkIcon} /> Have Derek Do It</li>
                    <li><Check size={13} className={styles.checkIcon} /> AI deliverable downloads</li>
                    <li><Check size={13} className={styles.checkIcon} /> Team Seats</li>
                  </ul>
                  <Link href="/auth" className={styles.btnSecondary} id="pricing-team-cta">
                    UPGRADE TEAM
                  </Link>
                </div>
              </TiltWrapper>
            </motion.div>
          </motion.div>
          <div className={styles.pricingGuaranteeSub}>
            * All paid tiers include our 14-day risk-free guarantee. If Derek does not improve your shipping speed, email us for a full refund. Cancel anytime in one click.
          </div>
        </motion.div>
      </section>

      {/* ── Disclaimer ── */}
      <div className={styles.disclaimerSection}>
        <div className={styles.sectionInner}>
          <div className={styles.disclaimerGrid}>
            <div className={styles.disclaimerCard}>
              <h4 className={styles.disclaimerTitle}>⚠️ SYSTEM LIMITATIONS &amp; DISCLAIMER</h4>
              <p className={styles.disclaimerText}>
                <strong>Model-Based Estimation:</strong> Decision Scores, KPI recommendations, and weekly action items are algorithmic predictions generated by large language models based on patterns and stated inputs. They do not guarantee market viability, product success, or revenue outcomes.
              </p>
              <p className={styles.disclaimerText}>
                <strong>Not Professional Counsel:</strong> Derek is an AI simulation. The Billionaire Brother does not provide certified legal, tax, financial, or investment advice. You must consult licensed professionals and utilize your own independent business judgment before executing any strategy.
              </p>
              <p className={styles.disclaimerText}>
                <strong>Operational Scope:</strong> Derek acts as an execution framework and accountability auditor. The Service cannot execute code, make sales calls, or recruit customers for you. Execution is entirely your responsibility.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <Link href="/" className={styles.footerBrand}>
            <Crown size={14} />
            <span>THE BILLIONAIRE BROTHER</span>
          </Link>
          <div className={styles.footerLinks}>
            <Link href="/terms" className={styles.footerLink}>Terms of Service</Link>
            <Link href="/privacy" className={styles.footerLink}>Privacy Policy</Link>
            <Link href="/contact" className={styles.footerLink}>Contact Strategist</Link>
            <Link href="/refunds" className={styles.footerLink}>Refund Policy</Link>
            <Link href="/data-usage" className={styles.footerLink}>AI Data Usage</Link>
            <Link href="/delete-account" className={styles.footerLink}>Delete Account</Link>
          </div>
          <span className={styles.footerCopy}>
            © {new Date().getFullYear()} The Billionaire Brother. All rights reserved.
          </span>
        </div>
      </footer>
    </main>
  );
}
