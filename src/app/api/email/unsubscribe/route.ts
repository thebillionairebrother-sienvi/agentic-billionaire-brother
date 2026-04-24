import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getServiceClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, customerId, reason, userId } = body;

    if (!email || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getServiceClient();
    
    // Add to suppressions
    const { error: suppError } = await supabase.from('suppressions').upsert({
      user_id: userId,
      email: email.toLowerCase(),
      reason: reason || 'User unsubscribed via link'
    }, { onConflict: 'user_id,email' });

    if (suppError) {
      throw new Error(suppError.message);
    }

    // Optionally log as an event if customerId is provided
    if (customerId) {
      await supabase.from('customer_events').insert({
        customer_id: customerId,
        event_type: 'unsubscribe',
        metadata: { reason }
      });
    }

    return NextResponse.json({ success: true, message: 'Unsubscribed successfully.' });
  } catch (error: any) {
    console.error('Unsubscribe error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
