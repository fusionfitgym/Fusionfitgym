import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMembershipExpiry } from '@/lib/utils';
import { sendExpiryWarningSMS, sendExpiredMembershipSMS } from '@/lib/sms';

export async function POST(request: NextRequest) {
  try {
    // 1. API Key Validation
    const apiKey = request.headers.get('x-api-key');
    const configuredKey = process.env.AUTOMATION_API_KEY;
    
    // Fallback or verify key if configured
    if (configuredKey && apiKey !== configuredKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // 2. Fetch all members who are currently Active or Expired
    // We fetch active to trigger warning & expired. We fetch expired to update status if missed, or check if expired alerts are already sent.
    // However, the warnings are only sent to Active members. Expired alerts can be sent to members who just transitioned.
    const { data: members, error: fetchError } = await supabase
      .from('members')
      .select('id, full_name, phone, join_date, status, membership_plan')
      .in('status', ['Active', 'Expired']);

    if (fetchError) {
      console.error('Failed to fetch members for expiry automation:', fetchError);
      return NextResponse.json({ error: 'Database fetch failed' }, { status: 500 });
    }

    if (!members || members.length === 0) {
      return NextResponse.json({ message: 'No members found to evaluate' });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const results = {
      warningsSent: 0,
      expiredNoticesSent: 0,
      statusUpdates: 0,
      skipped: 0,
    };

    for (const member of members) {
      if (!member.phone) continue;

      const expiry = getMembershipExpiry(member.join_date, member.membership_plan);
      const expiryDateOnly = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
      
      const diffTime = expiryDateOnly.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      // Condition A: 3 days before expiry
      if (diffDays === 3 && member.status === 'Active') {
        // Double check if warning already dispatched since join_date
        const { data: existingWarning, error: queryErr } = await supabase
          .from('sms_logs')
          .select('id')
          .eq('member_id', member.id)
          .eq('sms_type', 'Expiry Warning')
          .gte('created_at', member.join_date)
          .limit(1);

        if (queryErr) {
          console.error(`Error querying warning logs for ${member.full_name}:`, queryErr);
          continue;
        }

        if (!existingWarning || existingWarning.length === 0) {
          const smsResult = await sendExpiryWarningSMS(member.id, member.full_name, member.phone);
          if (smsResult.success) {
            results.warningsSent++;
          }
        } else {
          results.skipped++;
        }
      }
      // Condition B: Expiry date reached or passed
      else if (diffDays <= 0) {
        // Transition status to Expired if not already done
        if (member.status === 'Active') {
          const { error: updateErr } = await supabase
            .from('members')
            .update({ status: 'Expired' })
            .eq('id', member.id);

          if (updateErr) {
            console.error(`Failed to update status to Expired for ${member.full_name}:`, updateErr);
          } else {
            results.statusUpdates++;
          }
        }

        // Check if expired notice already dispatched since join_date
        const { data: existingExpired, error: queryErr } = await supabase
          .from('sms_logs')
          .select('id')
          .eq('member_id', member.id)
          .eq('sms_type', 'Expired')
          .gte('created_at', member.join_date)
          .limit(1);

        if (queryErr) {
          console.error(`Error querying expired logs for ${member.full_name}:`, queryErr);
          continue;
        }

        if (!existingExpired || existingExpired.length === 0) {
          const smsResult = await sendExpiredMembershipSMS(member.id, member.full_name, member.phone);
          if (smsResult.success) {
            results.expiredNoticesSent++;
          }
        } else {
          results.skipped++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Expiry check automation completed successfully',
      results,
    });

  } catch (err: any) {
    console.error('Unexpected error during expiry check automation:', err);
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}

// Allow GET request triggers in non-prod environments or via URL directly to make testing easier
export async function GET(request: NextRequest) {
  return POST(request);
}
