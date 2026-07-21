import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { queueBiometricAction } from '@/lib/actions/members';

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

    // 2. Fetch all members who are currently Active
    const { data: members, error: fetchError } = await supabase
      .from('members')
      .select('id, full_name, phone, package_start_date, package_end_date, status, duration, biometric_user_id, biometric_status, machine_type')
      .eq('status', 'Active');

    if (fetchError) {
      console.error('Failed to fetch members for expiry automation:', fetchError);
      return NextResponse.json({ error: 'Database fetch failed' }, { status: 500 });
    }

    if (!members || members.length === 0) {
      return NextResponse.json({ message: 'No active members found to evaluate' });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const results = {
      statusUpdates: 0,
      processed: 0,
    };

    for (const member of members) {
      if (member.duration === 'Daily Pass') continue;

      const expiry = new Date(member.package_end_date);
      const expiryDateOnly = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
      
      const diffTime = expiryDateOnly.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      // Case: Expiry date reached or passed (diffDays < 0)
      if (diffDays < 0) {
        // Transition status to Expired
        const { error: updateErr } = await supabase
          .from('members')
          .update({ 
            status: 'Expired',
            biometric_status: 'DISABLED',
            updated_at: new Date().toISOString()
          })
          .eq('id', member.id);

        if (updateErr) {
          console.error(`Failed to update status to Expired for ${member.full_name}:`, updateErr);
        } else {
          results.statusUpdates++;
          
          // Queue biometric disable command
          if (member.biometric_user_id) {
            try {
              await queueBiometricAction(member.id, member.biometric_user_id, 'disable');
            } catch (bioErr) {
              console.error(`Failed to queue biometric disable for expired member ${member.full_name}:`, bioErr);
            }
          }
        }
      }
      
      results.processed++;
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
