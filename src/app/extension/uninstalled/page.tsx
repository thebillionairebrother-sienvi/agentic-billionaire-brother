import Link from 'next/link';
import type { Metadata } from 'next';
import { PolicyLayout } from '@/components/PolicyLayout';
import { createServiceClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Extension Removed — The Billionaire Brother',
  description: 'The Billionaire Brother Execution Engine Chrome extension has been removed.',
  robots: {
    index: false,
    follow: false,
  },
};

const MAX_PARAM_LENGTH = 64;

function cleanParam(value: string | string[] | undefined): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || v.length > MAX_PARAM_LENGTH || !/^[\w.-]+$/.test(v)) return null;
  return v;
}

// Chrome opens this page after the extension is uninstalled (chrome.runtime.setUninstallURL).
// The admin dashboard counts distinct client ids, so reloads and prefetches don't inflate uninstalls.
export default async function ExtensionUninstalledPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const clientId = cleanParam(params.cid);
  const version = cleanParam(params.v);

  if (clientId) {
    try {
      const serviceClient = await createServiceClient();
      await serviceClient.from('audit_logs').insert({
        user_id: null,
        action: 'extension_telemetry',
        entity_type: 'event',
        metadata: {
          eventName: 'extension_uninstalled',
          params: version ? { ext_version: version } : {},
          clientId,
          recordedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('[extension/uninstalled] Failed to record uninstall:', err);
    }
  }

  return (
    <PolicyLayout title="Extension Removed" subtitle="Billionaire Brother Execution Engine">
      <p>
        The Billionaire Brother Execution Engine has been removed from Chrome. Extension data stored in your
        browser was deleted along with it.
      </p>
      <p>
        If something didn&apos;t work the way you expected, we&apos;d like to hear about it. Let us know through
        the <Link href="/contact" style={{ color: 'var(--gold-400)', textDecoration: 'underline' }}>contact page</Link>.
      </p>
    </PolicyLayout>
  );
}
