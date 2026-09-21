exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

    try {
        const { email, amount, orderId, orderData } = JSON.parse(event.body);
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email' }) };
        }
        if (typeof amount !== 'number' || amount <= 0 || amount > 10000000) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid amount' }) };
        }

        const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Paystack not configured' })
      };
    }

    // Initialize Paystack transaction
    const response = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          amount: Math.round(amount * 100),
          callback_url: `${process.env.SITE_URL || 'https://pricelessstones.netlify.app'}/payment-callback.html`,
          metadata: { orderId, orderData: JSON.stringify(orderData || {}) }
        })
      }
    );
    const responseData = await response.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        authorization_url: responseData.data.authorization_url,
        access_code: responseData.data.access_code,
        reference: responseData.data.reference
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Payment initialization failed' })
    };
  }
};
