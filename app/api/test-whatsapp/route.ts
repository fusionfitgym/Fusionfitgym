import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/actions/auth';
import { sendWhatsApp } from '@/lib/twilio';

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication & Authorization
    const authResult = await getCurrentUserProfile();
    if (!authResult || !authResult.user || !authResult.profile) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const role = authResult.profile.role;
    if (role !== 'Super Admin' && role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden. Only Admins can perform this action.' }, { status: 403 });
    }

    // 2. Parse request body
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { phone, message } = body;

    // 3. Validation
    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ error: 'Missing phone number' }, { status: 400 });
    }
    
    // Minimum 10 digits, only digits allowed (remove optional '+' at start)
    const cleanPhone = phone.replace(/^\+/, '').replace(/\s+/g, '');
    if (!/^\d{10,}$/.test(cleanPhone)) {
      return NextResponse.json({ error: 'Phone number must contain at least 10 digits and only contain numbers.' }, { status: 400 });
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    if (message.length > 1000) {
      return NextResponse.json({ error: 'Message cannot exceed 1000 characters.' }, { status: 400 });
    }

    // 4. Send Message via Twilio
    const startTime = Date.now();
    try {
      const result = await sendWhatsApp({
        to: cleanPhone,
        message,
      });
      
      const responseTime = Date.now() - startTime;
      
      console.log(`[WhatsApp Test] SUCCESS | Time: ${new Date().toISOString()} | Phone: ${cleanPhone} | Response Time: ${responseTime}ms`);
      
      return NextResponse.json({ success: true, result });
    } catch (apiError: any) {
      const responseTime = Date.now() - startTime;
      // Log the full Twilio error on the server only (already done in lib/twilio.ts, but we keep this log for request timing)
      console.error(`[WhatsApp Test] FAILURE | Time: ${new Date().toISOString()} | Phone: ${cleanPhone} | Response Time: ${responseTime}ms | Error: ${apiError.message}`);
      
      let statusCode = 500;
      const errorMsg = apiError.message || '';
      
      if (errorMsg.includes('credentials') || errorMsg.includes('Twilio authentication failure')) {
        statusCode = 401;
      } else if (errorMsg.includes('Rate limit')) {
        statusCode = 429;
      } else if (errorMsg.includes('Invalid phone number') || errorMsg.includes('Sandbox participant not joined')) {
        statusCode = 400;
      }

      return NextResponse.json({ error: errorMsg || 'Failed to send WhatsApp message.' }, { status: statusCode });
    }

  } catch (error: any) {
    console.error('Test WhatsApp Route Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
