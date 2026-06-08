import { PolicyLayout } from '@/components/PolicyLayout';
import Link from 'next/link';

export default function AiDataUsage() {
  return (
    <PolicyLayout title="AI Data Usage Policy" subtitle="Last Updated: June 9, 2026">
      <p>
        As an AI-driven business strategy platform, <strong>The Billionaire Brother</strong> processes operational metrics, 
        business models, and execution logs. We prioritize the security of your business strategies and data. 
        This policy explains how your information is handled by our AI systems.
      </p>

      <h2>1. AI Infrastructure & Model Providers</h2>
      <p>
        Derek's strategic reasoning, Decision Scores, and audit evaluations are generated using leading LLM models 
        (such as Google Gemini and OpenAI GPT-4) accessed via secure enterprise API integrations.
      </p>
      <p>
        <strong>Important:</strong> Under our enterprise API terms, <strong>none</strong> of the business information, 
        questionnaire responses, metrics, or chat logs you submit are used by our AI model providers to train, improve, 
        or fine-tune their public base models. Your business secrets remain yours.
      </p>

      <h2>2. What Data We Send to AI Models</h2>
      <p>
        To generate a coherent business playbook, we transmit the following contextual parameters to the model:
      </p>
      <ul>
        <li>Your questionnaire baseline (target audience, traffic, current revenue, tech stack).</li>
        <li>Your locked KPI metrics and active execution strategy.</li>
        <li>Your completed and pending Action Items.</li>
        <li>Your chat prompts when consulting Derek directly.</li>
      </ul>

      <h2>3. Where Data is Stored</h2>
      <p>
        We store your profile details, strategy histories, and task checklists in our encrypted database hosted by <strong>Supabase</strong>. 
        This allows us to maintain your active dashboard, show your progress calendar, and track your metrics over time. 
        AI model providers do not store your data long-term; they process it in memory to generate the response and retain logs 
        only for short-term compliance or abuse detection.
      </p>

      <h2>4. Data Minimization Recommendations</h2>
      <p>
        To help us protect your proprietary assets, we recommend practicing data minimization:
      </p>
      <ul>
        <li><strong>No Credentials:</strong> Never enter system passwords, API secret keys, database credentials, or sensitive customer databases into the questionnaire or chat.</li>
        <li><strong>Abstract Metrics:</strong> Instead of pasting full financial sheets, abstract them to percentages, high-level metrics (e.g. "$12,000 MRR," "1.4% conversion rate"), or general operational targets.</li>
        <li><strong>Focus on Logic:</strong> Consult Derek about the strategic and execution logic, rather than typing unreleased source code or protected intellectual property.</li>
      </ul>

      <h2>5. Strategy Resets and Data Deletion</h2>
      <p>
        You have control over the data stored in your strategic profile:
      </p>
      <ul>
        <li><strong>Strategy Reset:</strong> You can click the "Reset Strategy" button on your dashboard to wipe your current strategy, active tasks, and active KPIs, allowing you to start fresh.</li>
        <li><strong>Account Deletion:</strong> If you want to permanently erase your profile and wipe all strategy history logs, please follow the steps in our <Link href="/delete-account" style={{ color: 'var(--gold-400)', textDecoration: 'underline' }}>Account Deletion Guide</Link>.</li>
      </ul>

      <h2>6. Security Audits</h2>
      <p>
        We restrict internal team access to your strategy parameters. Logs are only reviewed by our support engineers 
        when you submit a ticket or explicitly request assistance debugging a strategy issue.
      </p>
    </PolicyLayout>
  );
}
