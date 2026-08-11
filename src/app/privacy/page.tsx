import { PolicyLayout } from '@/components/PolicyLayout';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | The Billionaire Brother',
  description: 'Learn how The Billionaire Brother website and Chrome extension collect, use, share, retain, and protect user data.',
  alternates: {
    canonical: '/privacy',
  },
};

const policyLinkStyle = {
  color: 'var(--gold-400)',
  textDecoration: 'underline',
};

export default function PrivacyPolicy() {
  return (
    <PolicyLayout title="Privacy Policy" subtitle="Last Updated: August 12, 2026">
      <p>
        At <strong>The Billionaire Brother</strong>, we respect your privacy and are committed to protecting
        your personal and business data. This Privacy Policy explains how we collect, use, share, retain,
        and safeguard information when you use our website, services, and the <strong>Billionaire Brother
        Execution Engine Chrome extension</strong> (collectively, the &quot;Service&quot;).
      </p>

      <h2>1. Information We Collect</h2>
      <p>Depending on the features you use, we collect the following categories of information:</p>
      <ul>
        <li>
          <strong>Account and Authentication Data:</strong> Your email address, name, account identifier,
          subscription tier, and authentication status. Authentication credentials are processed by our
          authentication provider; we do not store or display your raw password.
        </li>
        <li>
          <strong>Business and User-Provided Data:</strong> Questionnaire answers, business model, industry,
          revenue estimates, team size, goals, operational challenges, strategy inputs, chat messages,
          selected webpage text, and other information you intentionally submit to the Service.
        </li>
        <li>
          <strong>Chrome Extension Website Data:</strong> When you start an audit, the extension collects the
          URL, title, meta description, and visible page copy needed to perform the audit, including headings,
          hero copy, calls to action, pricing text, testimonials, FAQs, form labels, repeated phrases, selected
          text, and visible button labels.
        </li>
        <li>
          <strong>Optional Multi-Page Audit Data:</strong> If you choose Whole Site or Sub-pages and approve
          Chrome&apos;s site-access request, the extension may collect page copy from up to four linked pages on
          the same website to provide the requested multi-page audit.
        </li>
        <li>
          <strong>Audit and Service Data:</strong> The audit type, processing status, generated audit results,
          timestamps, and error information needed to provide and maintain the audit feature.
        </li>
        <li>
          <strong>Technical and Security Data:</strong> IP address, device and browser information, request and
          server logs, and limited usage information used to operate, secure, troubleshoot, and measure the
          reliability of the Service.
        </li>
        <li>
          <strong>Payment Data:</strong> Subscription and transaction details needed to manage your plan.
          Stripe processes payment-card information, and we do not store or inspect complete card numbers.
        </li>
      </ul>

      <h2>2. How the Chrome Extension Collects Data</h2>
      <p>
        The extension collects webpage data only after you open the extension and click an Audit button.
        It does not continuously monitor your browsing, collect your general browsing history in the
        background, read passwords, read payment-card fields, or collect values entered into webpage form fields.
      </p>
      <p>
        Active Page audits use temporary access to the tab you selected. Multi-page audits require a separate
        permission request for the current website. You can deny that request and continue using Active Page
        audits. The extension uses discovered links only to select same-site pages for the requested audit and
        removes the link-discovery list before sending the audit request to our servers.
      </p>

      <h2>3. How We Use Information</h2>
      <p>We use collected information only for the following purposes:</p>
      <ul>
        <li>Providing the webpage or website audit that you explicitly request.</li>
        <li>Generating conversion, strategy, and compliance-oriented analysis and reports.</li>
        <li>Authenticating your account and confirming access to subscription features.</li>
        <li>Displaying, saving, exporting, and retrieving your requested audit results.</li>
        <li>Providing personalized strategies, Decision Scores, tasks, and other Service features you use.</li>
        <li>Maintaining, securing, troubleshooting, and improving the accuracy and reliability of the Service.</li>
        <li>Preventing fraud, abuse, unauthorized access, and other security threats.</li>
        <li>Complying with applicable legal obligations.</li>
      </ul>
      <p>
        We do not use Chrome extension data for unrelated purposes, personalized advertising, determining
        creditworthiness, or lending decisions.
      </p>

      <h2>4. Data Sharing and Service Providers</h2>
      <p>
        We do not sell, rent, or trade personal information, webpage content, browsing activity, or audit data.
        We share data only as necessary to provide and protect the Service, as described below:
      </p>
      <ul>
        <li>
          <strong>Supabase:</strong> Provides account authentication, database storage, and access controls.
          Extension audit inputs, processing status, and results are stored in account-linked audit records.
        </li>
        <li>
          <strong>Google Gemini:</strong> Receives the webpage content and audit context needed to generate the
          audit requested by the user. Google processes this information as our AI infrastructure provider.
        </li>
        <li>
          <strong>Stripe:</strong> Processes subscriptions and payments; extension webpage content is not sent
          to Stripe.
        </li>
        <li>
          <strong>Google Analytics:</strong> Provides aggregate website traffic and engagement measurement;
          extension audit page content is not sent to Google Analytics for advertising.
        </li>
        <li>
          <strong>Resend:</strong> Delivers account and service-related email communications; extension webpage
          content is not sent to Resend.
        </li>
      </ul>
      <p>
        We may also disclose information when required by law or when reasonably necessary to protect the Service
        against fraud, malware, security threats, or abuse. We will not transfer Chrome extension user data as
        part of a merger, acquisition, or sale of assets without obtaining explicit prior user consent where
        required by the Chrome Web Store User Data Policy.
      </p>

      <h2>5. Artificial Intelligence Processing</h2>
      <p>
        Audit inputs are sent securely to Google Gemini to produce the requested analysis. Our AI provider receives
        only the information needed to generate the requested result. We do not permit AI providers to use your
        extension audit data to create personalized advertisements or to determine creditworthiness.
      </p>
      <p>
        For additional information about our AI processing practices, review our{' '}
        <Link href="/data-usage" style={policyLinkStyle}>AI Data Usage Policy</Link>.
      </p>

      <h2>6. Data Stored by the Chrome Extension</h2>
      <p>
        The extension stores limited information on your device using Chrome&apos;s local storage so the side panel
        can recover its state. This may include the audit status, generated result, run identifier, audit scope,
        and minimal display information such as the page URL and title. Extracted webpage copy is not retained in
        the extension&apos;s local storage after it is sent for the requested audit. Resetting the audit removes the
        locally stored audit state, and uninstalling the extension removes its local extension storage.
      </p>

      <h2>7. Server Retention and Deletion</h2>
      <p>
        Extension audit inputs and results are retained in account-linked audit records so we can process the
        audit, return its status and result, provide account history where available, troubleshoot failures, and
        protect the Service. We retain this information only for as long as reasonably necessary for these
        purposes, while your account remains active, or as required for legal, fraud-prevention, or security needs.
      </p>
      <p>
        You may request deletion of your account and associated audit data through the methods described in our{' '}
        <Link href="/delete-account" style={policyLinkStyle}>Account Deletion Guide</Link>. Verified manual deletion
        requests are processed according to that guide. Encrypted backup copies may remain for up to 30 days before
        being overwritten and are not used for ordinary business operations.
      </p>

      <h2>8. Chrome Web Store Limited Use Compliance</h2>
      <p>
        <strong>
          The use of information received from Chrome APIs will adhere to the Chrome Web Store User Data Policy,
          including the Limited Use requirements.
        </strong>
      </p>
      <p>For data obtained through the Chrome extension, this means:</p>
      <ul>
        <li>We use the data only to provide or improve the extension&apos;s single purpose and related operations.</li>
        <li>We transfer data only when necessary to provide or improve that purpose, comply with law, protect against security threats or abuse, or complete a business transfer after obtaining any required explicit prior consent.</li>
        <li>We do not sell or transfer the data to advertising platforms, data brokers, or information resellers.</li>
        <li>We do not use or transfer the data for personalized, retargeted, or interest-based advertising.</li>
        <li>We do not use or transfer the data to determine creditworthiness or for lending purposes.</li>
        <li>We do not allow humans to read the data unless you give explicit consent for specific data, it is necessary for security or legal compliance, or it has been aggregated and anonymized for permitted internal operations.</li>
      </ul>

      <h2>9. Data Security</h2>
      <p>
        We use HTTPS/TLS to protect information transmitted between the extension, our servers, and our service
        providers. We use authentication, database access controls, and other administrative and technical
        safeguards designed to protect stored data. No system is completely secure, so we cannot guarantee
        absolute security.
      </p>

      <h2>10. Your Choices and Rights</h2>
      <ul>
        <li>You decide whether and when to run an audit.</li>
        <li>You may deny optional multi-page site access and use the Active Page feature instead.</li>
        <li>You may reset locally stored audit state or uninstall the extension.</li>
        <li>You may request access to, correction of, or deletion of personal data, subject to applicable law.</li>
        <li>You may delete your account or submit a verified manual deletion request.</li>
      </ul>
      <p>
        Depending on your location, including the European Economic Area, United Kingdom, or California, you may
        have additional privacy rights under applicable law.
      </p>

      <h2>11. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy to reflect changes to the Service, our data practices, or legal
        requirements. We will update the date shown above and provide any additional notice or consent required
        by applicable law or Chrome Web Store policy before materially changing how extension data is used.
      </p>

      <h2>12. Contact Us</h2>
      <p>
        For privacy questions, data-access requests, or deletion requests, contact us through the{' '}
        <Link href="/contact" style={policyLinkStyle}>Contact Strategist</Link> form. Please use the email address
        connected to your account so we can verify and process account-specific requests securely.
      </p>
    </PolicyLayout>
  );
}
