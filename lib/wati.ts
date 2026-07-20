export async function sendSessionMessage(phone: string, message: string) {
  const token = process.env.WATI_API_TOKEN;
  const baseUrl = process.env.WATI_BASE_URL;

  if (!token || !baseUrl) {
    throw new Error('Wati API credentials (WATI_API_TOKEN or WATI_BASE_URL) are missing.');
  }

  // Ensure base URL doesn't end with slash
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  // Endpoint remains unchanged without query parameters
  const endpoint = `${normalizedBaseUrl}/api/v1/sendSessionMessage/${phone}`;
  
  // Using URLSearchParams to format as application/x-www-form-urlencoded
  const body = new URLSearchParams();
  body.append("messageText", message);
  const requestBody = body.toString();

  // Mask token for secure logging
  const maskedToken = token.length > 8 
    ? `${token.slice(0, 4)}...${token.slice(-4)}`
    : '***';

  const makeRequest = async (authHeaderValue: string) => {
    console.log('\n--- [Wati API] Request Details ---');
    console.log('Final URL:', endpoint);
    console.log('Authorization header:', authHeaderValue.replace(token, maskedToken));
    console.log('Content-Type:', 'application/x-www-form-urlencoded');
    console.log('Request Body:', requestBody);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeaderValue,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: requestBody
    });

    const text = await response.text();
    
    console.log('HTTP Status:', response.status);
    console.log('Complete Wati Response:', text);
    console.log('----------------------------------\n');

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON response from Wati API: ${text}`);
    }

    return { response, data };
  };
  
  try {
    // Attempt 1: Standard Bearer Token
    let { response, data } = await makeRequest(`Bearer ${token}`);

    // If we receive an error from Wati, check if it's an authorization/token issue
    if (!response.ok || data.result === false) {
      const errorMsg = data.info || data.message || data.error || '';
      
      // Some Wati V1 instances require raw token. Retry once if auth failed.
      if (response.status === 401 || errorMsg.toLowerCase().includes('unauthorized') || errorMsg.includes('invalid token')) {
        console.log('[Wati API] First attempt failed. Retrying using raw token (without Bearer prefix)...');
        
        const retryResult = await makeRequest(token);
        response = retryResult.response;
        data = retryResult.data;
        
        if (response.ok && data.result !== false) {
          console.log('[Wati API] SUCCESS: Authenticated successfully using raw token method.');
        }
      }
    } else {
      console.log('[Wati API] SUCCESS: Authenticated successfully using Bearer token method.');
    }

    // After retries, if still failing, throw exact Wati error
    if (!response.ok || data.result === false) {
      throw new Error(data.info || data.message || data.error || `Wati API Error (${response.status})`);
    }

    return data;
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message === 'fetch failed') {
      throw new Error('Network timeout or connection refused connecting to Wati API');
    }
    throw error;
  }
}

export async function sendTemplateMessage(phone: string, templateName: string, parameters: any[] = []) {
  const token = process.env.WATI_API_TOKEN;
  const baseUrl = process.env.WATI_BASE_URL;

  if (!token || !baseUrl) {
    throw new Error('Wati API credentials (WATI_API_TOKEN or WATI_BASE_URL) are missing.');
  }

  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const endpoint = `${normalizedBaseUrl}/api/v1/sendTemplateMessage?whatsappNumber=${phone}`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        template_name: templateName,
        broadcast_name: templateName,
        parameters: parameters
      })
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON response from Wati API: ${text}`);
    }

    if (!response.ok) {
      throw new Error(data.info || data.message || data.error || `Wati API Error (${response.status})`);
    }

    return data;
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message === 'fetch failed') {
      throw new Error('Network timeout or connection refused connecting to Wati API');
    }
    throw error;
  }
}

export async function sendAutoWhatsAppMessage(
  phone: string,
  message: string,
  templateName: string,
  parameters: any[] = [],
  memberId?: string
) {
  try {
    // 1. Try Session Message first
    const result = await sendSessionMessage(phone, message);
    console.log(`[WhatsApp Log] WhatsApp Welcome sent via Session | Phone: ${phone} | Member ID: ${memberId || 'N/A'}`);
    return result;
  } catch (error: any) {
    const errorMsg = error.message || '';
    const shouldFallback = 
      errorMsg.toLowerCase().includes('conversation not found') ||
      errorMsg.toLowerCase().includes('session expired') ||
      errorMsg.toLowerCase().includes('outside 24 hour window') ||
      errorMsg.toLowerCase().includes('no active session');

    if (shouldFallback) {
      console.log(`[WhatsApp Log] Session message failed due to: ${errorMsg}. Falling back to template message. | Phone: ${phone} | Member ID: ${memberId || 'N/A'}`);
      
      try {
        const templateResult = await sendTemplateMessage(phone, templateName, parameters);
        console.log(`[WhatsApp Log] WhatsApp Welcome sent via Template | Phone: ${phone} | Member ID: ${memberId || 'N/A'} | Template Name: ${templateName}`);
        return templateResult;
      } catch (templateError: any) {
        console.error(`[WhatsApp Log] WhatsApp Failed | Phone: ${phone} | Member ID: ${memberId || 'N/A'} | Template Name: ${templateName} | Wati Response: ${templateError.message}`);
        throw templateError;
      }
    } else {
      console.error(`[WhatsApp Log] WhatsApp Failed (Session error not eligible for fallback) | Phone: ${phone} | Member ID: ${memberId || 'N/A'} | Wati Response: ${errorMsg}`);
      throw error;
    }
  }
}
