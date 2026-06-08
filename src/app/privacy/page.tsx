import { PolicyLayout } from '@/components/PolicyLayout';
import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <PolicyLayout title="Privacy Policy" subtitle="Effective Date: June 9, 2026">
      <p>
        At <strong>The Billionaire Brother</strong>, we respect your privacy and are committed to protecting 
        your personal and business data. This Privacy Policy explains how we collect, use, and safeguard 
        your information when you visit and use our website.
      </p>

      <h2>1. Information We Collect</h2>
      <p>
        To deliver personalized AI business strategies, we collect the following types of information:
      </p>
      <ul>
        <li><strong>Account Registration Data:</strong> Email address, password, and name provided during signup.</li>
        <li><strong>Questionnaire & Interview Data:</strong> Your business model, industry, revenue estimates, team sizes, operational bottlenecks, risk profiles, and targets.</li>
        <li><strong>Payment Data:</strong> All financial transactions are securely processed via Stripe. We do not store or inspect your raw credit card numbers or billing details.</li>
        <li><strong>Technical Logs:</strong> IP address, device type, browser settings, and page engagement data gathered for analytics and security purposes.</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <p>
        We use the collected information for these primary purposes:
      </p>
      <ul>
        <li>Synthesizing custom strategies, Decision Scores, and weekly action items.</li>
        <li>Authenticating your account and managing billing/subscription tiers.</li>
        <li>Improving Derek's AI response accuracy and relevance.</li>
        <li>Monitoring platform stability and preventing fraudulent use or abuse.</li>
      </ul>

      <h2>3. Data Sharing & Third-Party Service Providers</h2>
      <p>
        We do not sell, rent, or trade your personal or business data. We share data only with trusted infrastructure providers required to operate the Service:
      </p>
      <ul>
        <li><strong>Supabase:</strong> For account authentication, user storage, and database persistence.</li>
        <li><strong>Stripe:</strong> For processing secure payment transactions.</li>
        <li><strong>Google Analytics:</strong> For aggregate website traffic metrics and behavior analysis.</li>
        <li><strong>AI Infrastructure Partners (Gemini / OpenAI API):</strong> Your questionnaire inputs and chat dialogues are sent securely to these API endpoints to generate Derek's strategic replies.</li>
      </ul>

      <h2>4. AI Data Usage and Retention</h2>
      <p>
        Since we process business data using advanced AI, we have strict safeguards:
      </p>
      <ul>
        <li>Inputs sent to our AI API providers are NOT used by them to train public foundation models.</li>
        <li>You can view, update, or clear your business questionnaire profile from your active dashboard at any time.</li>
        <li>For detailed policies regarding data sharing with model providers and your data control, please review our dedicated <Link href="/data-usage" style={{ color: 'var(--gold-400)', textDecoration: 'underline' }}>AI Data Usage Policy</Link>.</li>
      </ul>

      <h2>5. Security of Your Data</h2>
      <p>
        We implement industry-standard encryption protocols (SSL/TLS) for data in transit and secure database practices for data at rest. While we take exhaustive measures, no digital transmission is 100% secure. You share information at your own discretion.
      </p>

      <h2>6. Your Rights & Account Deletion</h2>
      <p>
        Depending on your location (such as the EU under GDPR or California under CCPA), you have rights regarding access to, modification of, or complete erasure of your personal data.
      </p>
      <p>
        If you wish to terminate your account and wipe all stored strategy parameters, please consult our <Link href="/delete-account" style={{ color: 'var(--gold-400)', textDecoration: 'underline' }}>Account Deletion Guide</Link> for instructions.
      </p>

      <h2>7. Changes to this Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. When we make updates, the "Effective Date" at the top will change. We recommend reviewing this page periodically to stay informed about our data handling practices.
      </p>

      <h2>8. Contact Us</h2>
      <p>
        For inquiries regarding our privacy standards or data security measures, please contact our team via the <Link href="/contact" style={{ color: 'var(--gold-400)', textDecoration: 'underline' }}>Contact Strategist</Link> form.
      </p>
    </PolicyLayout>
  );
}
