const axios = require('axios');

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
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: Math.round(amount * 100), // Paystack expects amount in kobo (kobo = 1/100 Naira)
        callback_url: `${process.env.SITE_URL || 'https://pricelessstones.netlify.app'}/payment-callback.html`,
        metadata: { orderId, orderData: JSON.stringify(orderData || {}) }
      },
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        authorization_url: response.data.data.authorization_url,
        access_code: response.data.data.access_code,
        reference: response.data.data.reference
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Payment initialization failed' })
    };
  }
};
