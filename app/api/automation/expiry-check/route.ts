import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendExpiryWarningSMS, sendExpiredMembershipSMS, sendRenewalSMS } from '@/lib/sms';

/**
 * Check if a specific SMS type has been sent to the member since their package started
 */
async function hasSentNotification(
  supabase: any,
  memberId: string,
  type: string,
  startDate: string
): Promise<boolean> {
  let typeCol = 'sms_type';
  try {
    const { error } = await supabase.from('sms_logs').select('message_type').limit(1);
    if (!error) {
      typeCol = 'message_type';
    }
  } catch {}

  const { data } = await supabase
    .from('sms_logs')
    .select('id')
    .eq('member_id', memberId)
    .eq(typeCol, type)
    .gte('created_at', startDate)
    .limit(1);

  return !!data && data.length > 0;
}

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
    const { data: members, error: fetchError } = await supabase
      .from('members')
      .select('id, full_name, phone, package_start_date, package_end_date, status')
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

      const expiry = new Date(member.package_end_date);
      const expiryDateOnly = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
      
      const diffTime = expiryDateOnly.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      // Case 1: 7 days before expiry
      if (diffDays === 7 && member.status === 'Active') {
        const alreadySent = await hasSentNotification(supabase, member.id, 'Expiry Warning (7 days)', member.package_start_date);
        
        if (!alreadySent) {
          const smsResult = await sendExpiryWarningSMS(member.id, member.full_name, member.phone, 7);
          if (smsResult.success) {
            results.warningsSent++;
          }
        } else {
          results.skipped++;
        }
      }
      
      // Case 2: 3 days before expiry
      else if (diffDays === 3 && member.status === 'Active') {
        const alreadySent = await hasSentNotification(supabase, member.id, 'Expiry Warning (3 days)', member.package_start_date);
        
        if (!alreadySent) {
          const smsResult = await sendExpiryWarningSMS(member.id, member.full_name, member.phone, 3);
          if (smsResult.success) {
            results.warningsSent++;
          }
        } else {
          results.skipped++;
        }
      }

      // Case 3: Expires today (0 days)
      else if (diffDays === 0 && member.status === 'Active') {
        const alreadySent = await hasSentNotification(supabase, member.id, 'Renewal', member.package_start_date);
        
        if (!alreadySent) {
          const smsResult = await sendRenewalSMS(member.id, member.full_name, member.package_end_date, member.phone);
          if (smsResult.success) {
            results.warningsSent++;
          }
        } else {
          results.skipped++;
        }
      }

      // Case 4: Expiry date reached or passed
      else if (diffDays < 0) {
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
            member.status = 'Expired'; // update in-memory status
          }
        }

        // Check if expired notice already dispatched since join_date
        const alreadySentExpired = await hasSentNotification(supabase, member.id, 'Expired', member.package_start_date);

        if (!alreadySentExpired) {
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

// Allow GET triggers for convenience
export async function GET(request: NextRequest) {
  return POST(request);
}
