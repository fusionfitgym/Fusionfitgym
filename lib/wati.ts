export async function sendSessionMessage(phone: string, message: string) {
  const token = process.env.WATI_API_TOKEN;
  const baseUrl = process.env.WATI_BASE_URL;

  if (!token || !baseUrl) {
    throw new Error('Wati API credentials (WATI_API_TOKEN or WATI_BASE_URL) are missing.');
  }

  // Ensure base URL doesn't end with slash
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const endpoint = `${normalizedBaseUrl}/api/v1/sendSessionMessage/${phone}`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messageText: message
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
