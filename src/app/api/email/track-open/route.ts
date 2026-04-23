import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Helper to get service role client for unauthenticated webhook/pixel events
const getServiceClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sendId = searchParams.get('s');
    const customerId = searchParams.get('c');
    
    if (sendId && customerId) {
      const supabase = getServiceClient();
      
      // Track open event
      await supabase.from('customer_events').insert({
        customer_id: customerId,
        send_id: sendId,
        event_type: 'open',
        metadata: {
          userAgent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for')
        }
      });
    }

    // Return a 1x1 transparent pixel
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    return new NextResponse(pixel, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  } catch (error) {
    // Fail silently for tracking pixels
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    return new NextResponse(pixel, { headers: { 'Content-Type': 'image/gif' } });
  }
}
