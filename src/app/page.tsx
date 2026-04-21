'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Crown, ArrowRight, Target, TrendingUp, Shield, Check, Users, Terminal, ChevronRight, X } from 'lucide-react';
import styles from './page.module.css';
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

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

export default function LandingPage() {
  return (
    <main id="main-content" className={styles.page}>

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
            <Link href="/#pricing" className={styles.navLink}>PRICING</Link>
            <Link href="/#features" className={styles.navLink}>FEATURES</Link>
          </div>
          <Link href="/auth" className={styles.navCta}>
            ACCESS TERMINAL →
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          {/* Left: headline block */}
          <div className={styles.heroLeft}>
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
              force you to ship. No fluff. Just metrics and execution.
            </p>

            <div className={styles.heroCTA}>
              <Link href="/auth" className={styles.ctaPrimary} id="hero-cta">
                START FREE QUESTIONNAIRE →
              </Link>
            </div>
          </div>

          {/* Right: terminal card */}
          <div className={styles.heroRight}>
            <div className={styles.terminalCard}>
              <div className={styles.terminalBar}>
                <div className={styles.terminalDots}>
                  <span className={styles.dot} style={{ background: '#ff5f56' }} />
                  <span className={styles.dot} style={{ background: '#ffbd2e' }} />
                  <span className={styles.dot} style={{ background: '#27c93f' }} />
                </div>
                <span className={styles.terminalTitle}>derek_terminal.sh</span>
              </div>
              <AnimatedTerminal />
            </div>
          </div>
        </div>
      </section>

      {/* ── VSL Placeholder ── */}
      <section className={styles.vslSection}>
        <div className={styles.vslInner}>
          <div className={styles.vslPlaceholder}>
            <span className={styles.vslText}>[ VSL Placeholder ]</span>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className={styles.howItWorks}>
        <motion.div 
          className={styles.sectionInner}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className={styles.sectionMeta}>
            <span className={styles.sectionLabel}>THE PROTOCOL</span>
            <h2 className={styles.sectionTitle}>How It Works</h2>
            <p className={styles.sectionTagline}>
              A systematic dismantling of your comfort zone. Execute the steps, or get left behind.
            </p>
          </div>

          <div className={styles.stepsGrid}>
            <div className={styles.stepCard}>
              <div className={styles.stepIconRow}>
                <Target size={36} className={styles.stepIcon} />
                <span className={styles.stepNum}>01</span>
              </div>
              <h3 className={styles.stepTitle}>Questionnaire</h3>
              <p className={styles.stepBody}>
                Submit your current status. Derek processes your inputs to establish a
                baseline of your operational efficiency and glaring weaknesses.
              </p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepIconRow}>
                <TrendingUp size={36} className={styles.stepIcon} />
                <span className={styles.stepNum}>02</span>
              </div>
              <h3 className={styles.stepTitle}>Strategy &amp; KPIs</h3>
              <p className={styles.stepBody}>
                Receive a bespoke, unvarnished strategy. Key Performance Indicators are
                locked in. There is no room for interpretation.
              </p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepIconRow}>
                <ChevronRight size={36} className={styles.stepIcon} />
                <span className={styles.stepNum}>03</span>
              </div>
              <h3 className={styles.stepTitle}>Execute &amp; Ship</h3>
              <p className={styles.stepBody}>
                The mandate is execution. Follow the weekly directives. Report back. If you
                fail, Derek will ensure you know exactly why.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Features / Arsenal ── */}
      <section className={styles.arsenal} id="features">
        <motion.div 
          className={styles.sectionInner}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className={styles.sectionMeta}>
            <span className={styles.sectionLabel}>THE ARSENAL</span>
            <h2 className={styles.sectionTitle}>Tools for Unapologetic<br />Growth.</h2>
          </div>

          <div className={styles.arsenalGrid}>
            {/* Decision Scores — large card */}
            <div className={styles.arsenalCardLg}>
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
            </div>

            {/* Weekly Action Steps */}
            <div className={styles.arsenalCardSm}>
              <TrendingUp size={20} className={styles.arsenalIcon} />
              <h3 className={styles.arsenalTitle}>Weekly Action Steps</h3>
              <p className={styles.arsenalBody}>
                Bite-sized, uncompromising directives issued every Monday. No broad theories.
                Only actionable commands.
              </p>
            </div>

            {/* Red Team QA */}
            <div className={styles.arsenalCardSm}>
              <Shield size={20} className={styles.arsenalIcon} />
              <h3 className={styles.arsenalTitle}>Red Team QA</h3>
              <p className={styles.arsenalBody}>
                Before you launch, Derek stress-tests your idea. Finding vulnerabilities before
                the market does.
              </p>
            </div>

            {/* System Architecture image-card */}
            <div className={styles.arsenalImageCard}>
              <Image src="/images/strategies/strategy-growth.png" alt="Strategy Growth" fill style={{ objectFit: 'cover' }} />
              <div className={styles.arsenalImageOverlay}>
                <span className={styles.arsenalImageLabel}>System Architecture</span>
                <span className={styles.arsenalSecureBadge}>SECURE</span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Pricing ── */}
      <section className={styles.pricing} id="pricing">
        <motion.div 
          className={styles.sectionInner}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className={styles.sectionMetaCenter}>
            <span className={styles.sectionLabel}>ACCESS TIERS</span>
            <h2 className={styles.sectionTitleLg}>Invest in Discipline.</h2>
          </div>

          <div className={styles.pricingGrid}>
            {/* Free */}
            <div className={styles.pricingCard}>
              <div className={styles.pricingTierLabel}>FREE</div>
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

            {/* Brother — featured */}
            <div className={`${styles.pricingCard} ${styles.pricingCardFeatured}`}>
              <div className={styles.mostPopularBadge}>MOST POPULAR</div>
              <div className={styles.pricingTierLabel}>BROTHER PLAN</div>
              <div className={styles.pricingPrice}>
                <span className={styles.priceCurrency}>$</span>
                <span className={styles.priceAmount}>99.99</span>
                <span className={styles.pricePeriod}>/mo</span>
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

            {/* Team */}
            <div className={styles.pricingCard}>
              <div className={styles.pricingTierLabel}>TEAM PLAN</div>
              <div className={styles.pricingPrice}>
                <span className={styles.priceCurrency}>$</span>
                <span className={styles.priceAmount}>199</span>
                <span className={styles.pricePeriod}>/mo</span>
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
          </div>
        </motion.div>
      </section>

      {/* ── Disclaimer ── */}
      <div className={styles.disclaimer}>
        <div className={styles.sectionInner}>
          ⚠️&nbsp; Decision Scores are model-based estimates, not guarantees. They reflect pattern
          matching against stated inputs and documented assumptions. Results depend on execution
          quality and market conditions.
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
            <Link href="/framework" className={styles.footerLink}>Terms of Service</Link>
            <Link href="/framework" className={styles.footerLink}>Privacy Policy</Link>
            <Link href="/framework" className={styles.footerLink}>Contact Strategist</Link>
            <Link href="/auth" className={styles.footerLink}>System Status</Link>
          </div>
          <span className={styles.footerCopy}>
            © {new Date().getFullYear()} The Billionaire Brother. All rights reserved.
          </span>
        </div>
      </footer>
    </main>
  );
}
