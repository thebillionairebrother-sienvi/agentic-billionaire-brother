import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const redirectUrl = searchParams.get('url');

    if (!redirectUrl) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    if (sendId && customerId) {
      const supabase = getServiceClient();
      
      // Track click event
      await supabase.from('customer_events').insert({
        customer_id: customerId,
        send_id: sendId,
        event_type: 'click',
        metadata: {
          url: redirectUrl,
          userAgent: request.headers.get('user-agent')
        }
      });
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Track click error:', error);
    return NextResponse.redirect(new URL('/', request.url));
  }
}
