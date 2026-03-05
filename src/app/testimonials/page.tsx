import Link from 'next/link';
import { Crown, ArrowRight, Star, Quote } from 'lucide-react';
import styles from './page.module.css';

const testimonials = [
    {
        name: 'Marcus T.',
        role: 'E-commerce Founder',
        avatar: 'M',
        rating: 5,
        quote: 'Derek called out every excuse I was making and gave me a real plan. Within 2 weeks, I went from spinning my wheels to actually shipping. The weekly Ship Packs keep me accountable — no more "I\'ll do it tomorrow."',
        highlight: 'Went from spinning wheels to shipping in 2 weeks',
        color: 'var(--gold-400)',
    },
    {
        name: 'Sarah K.',
        role: 'SaaS Startup Founder',
        avatar: 'S',
        rating: 5,
        quote: 'I was drowning in ideas and couldn\'t commit to one direction. The Decision Scores made it crystal clear which path had the highest probability of success. Best $79/mo I\'ve ever spent.',
        highlight: 'Decision Scores clarified the best path forward',
        color: 'var(--accent-blue)',
    },
    {
        name: 'James L.',
        role: 'Freelancer → Agency Owner',
        avatar: 'J',
        rating: 5,
        quote: 'Derek doesn\'t sugarcoat anything. He told me my first idea was trash, explained exactly why, then helped me pivot to something with real demand. My agency hit $10K/mo in 3 months.',
        highlight: '$10K/mo in 3 months after pivoting',
        color: 'var(--accent-green)',
    },
    {
        name: 'Priya M.',
        role: 'Content Creator',
        avatar: 'P',
        rating: 5,
        quote: 'The Probability Engine is insane. It broke down every assumption I was making and showed me where my blind spots were. I feel like I have a billionaire mentor on speed dial.',
        highlight: 'Identified blind spots with the Probability Engine',
        color: 'var(--accent-purple)',
    },
    {
        name: 'David R.',
        role: 'Real Estate Side Hustler',
        avatar: 'D',
        rating: 5,
        quote: 'I was working 60 hours/week with nothing to show for it. Derek forced me to cut the fluff and focus on one revenue path. The Kill/Keep/Double framework changed how I think about my week.',
        highlight: 'Kill/Keep/Double framework transformed productivity',
        color: 'var(--gold-400)',
    },
    {
        name: 'Nina W.',
        role: 'Coaching Business Owner',
        avatar: 'N',
        rating: 5,
        quote: 'Most AI tools give you generic advice. Derek actually understands context — my constraints, my budget, my strengths. The strategies it generated were better than what I got from a $5K consultant.',
        highlight: 'Better strategies than a $5K consultant',
        color: 'var(--accent-blue)',
    },
];

export default function TestimonialsPage() {
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
                    <Star size={14} />
                    <span>Real Founders. Real Results.</span>
                </div>
                <h1 className={styles.heroTitle}>
                    They Bet On
                    <br />
                    <span className={styles.heroGold}>Themselves.</span>
                </h1>
                <p className={styles.heroSub}>
                    Hear from founders who stopped making excuses, committed to a strategy,
                    and started shipping. Derek pushed them — and they thanked him for it.
                </p>
            </section>

            {/* Testimonials Grid */}
            <section className={styles.testimonialSection}>
                <div className={styles.testimonialGrid}>
                    {testimonials.map((t, i) => (
                        <div
                            key={i}
                            className={styles.testimonialCard}
                            style={{ animationDelay: `${i * 80}ms` }}
                        >
                            <div className={styles.quoteIcon}>
                                <Quote size={20} />
                            </div>

                            {/* Stars */}
                            <div className={styles.stars}>
                                {Array.from({ length: t.rating }).map((_, j) => (
                                    <Star key={j} size={14} fill="var(--gold-400)" color="var(--gold-400)" />
                                ))}
                            </div>

                            {/* Quote */}
                            <p className={styles.quoteText}>"{t.quote}"</p>

                            {/* Highlight */}
                            <div className={styles.highlight} style={{ borderColor: t.color }}>
                                <span style={{ color: t.color }}>{t.highlight}</span>
                            </div>

                            {/* Author */}
                            <div className={styles.author}>
                                <div className={styles.authorAvatar} style={{ background: `linear-gradient(135deg, ${t.color}, var(--bg-elevated))` }}>
                                    {t.avatar}
                                </div>
                                <div>
                                    <div className={styles.authorName}>{t.name}</div>
                                    <div className={styles.authorRole}>{t.role}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className={styles.ctaSection}>
                <div className={styles.ctaCard}>
                    <h2 className="heading-lg">Ready to Stop Guessing?</h2>
                    <p className="text-secondary" style={{ maxWidth: 480, margin: '0 auto', marginTop: 'var(--space-4)' }}>
                        Join founders who are shipping with clarity instead of chaos.
                        10 minutes. 3 strategies. One commitment.
                    </p>
                    <Link href="/auth" className="btn btn-primary btn-lg" style={{ marginTop: 'var(--space-6)' }}>
                        Start Free Questionnaire <ArrowRight size={18} />
                    </Link>
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
