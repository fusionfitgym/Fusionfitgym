import twilio from 'twilio';

interface SendWhatsAppParams {
  to: string;
  message: string;
}

export async function sendWhatsApp({ to, message }: SendWhatsAppParams) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    throw new Error('Missing Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM)');
  }

  const client = twilio(accountSid, authToken);

  // Convert to WhatsApp format
  const cleanPhone = to.replace(/^\+/, '').replace(/\s+/g, '');
  const formattedTo = `whatsapp:+${cleanPhone}`;
  
  // Ensure from number is formatted correctly
  const formattedFrom = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;

  try {
    const result = await client.messages.create({
      body: message,
      from: formattedFrom,
      to: formattedTo,
    });
    
    return result;
  } catch (error: any) {
    // We log the full error on the server
    console.error('[Twilio Error]:', error);

    // Map Twilio error codes to user-friendly messages
    if (error.code === 20003) {
      throw new Error('Twilio authentication failure');
    }
    if (error.code === 21211 || error.code === 21614) {
      throw new Error('Invalid phone number');
    }
    if (error.code === 63015) {
      throw new Error('Sandbox participant not joined');
    }
    if (error.code === 20429) {
      throw new Error('Rate limit');
    }
    
    throw new Error('Unknown error');
  }
}
