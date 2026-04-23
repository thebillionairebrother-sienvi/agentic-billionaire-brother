import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';

export async function POST(request: Request) {
  try {
    const { user } = await requireAdmin();
    const supabase = await createClient();
    
    const body = await request.json();
    const { rawText, groupId } = body;

    if (!rawText || typeof rawText !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid rawText' }, { status: 400 });
    }

    // Parse emails from raw text (simple regex for comma, newline, or space separated)
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
    const extractedEmails = rawText.match(emailRegex) || [];
    const uniqueEmails = [...new Set(extractedEmails.map(e => e.toLowerCase()))];

    if (uniqueEmails.length === 0) {
      return NextResponse.json({ error: 'No valid emails found' }, { status: 400 });
    }

    // Insert customers (ignore duplicates)
    const customersToInsert = uniqueEmails.map(email => ({
      user_id: user.id, // Grouping under the admin who imported them
      email,
    }));

    const { data: insertedCustomers, error: insertError } = await supabase
      .from('customers')
      .upsert(customersToInsert, { onConflict: 'user_id,email', ignoreDuplicates: true })
      .select('id');

    if (insertError) {
      console.error('Import insert error:', insertError);
      return NextResponse.json({ error: 'Failed to insert customers' }, { status: 500 });
    }

    let groupAssignedCount = 0;

    // If groupId is provided, we need to assign all these emails to the group
    if (groupId) {
      // Re-fetch customer IDs because upsert ignoreDuplicates might not return existing IDs
      const { data: existingCustomers } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .in('email', uniqueEmails);

      if (existingCustomers && existingCustomers.length > 0) {
        const membershipsToInsert = existingCustomers.map(c => ({
          group_id: groupId,
          customer_id: c.id
        }));

        const { error: groupError } = await supabase
          .from('customer_group_memberships')
          .upsert(membershipsToInsert, { onConflict: 'group_id,customer_id', ignoreDuplicates: true });

        if (groupError) {
          console.error('Group assignment error:', groupError);
        } else {
          groupAssignedCount = membershipsToInsert.length;
        }
      }
    }

    return NextResponse.json({
      success: true,
      foundCount: uniqueEmails.length,
      insertedCount: insertedCustomers?.length || 0,
      groupAssignedCount
    });

  } catch (error: any) {
    console.error('Contacts import error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
