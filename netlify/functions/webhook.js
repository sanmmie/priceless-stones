const crypto = require('crypto');
const axios = require('axios');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const signature = event.headers['x-paystack-signature'];
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey || !signature) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing signature or key' }) };
    }

    // Verify Paystack signature
    const body = event.body;
    const expectedSignature = crypto
      .createHmac('sha512', secretKey)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid signature' }) };
    }

    const eventData = JSON.parse(body);
    const eventType = eventData.event;

    if (eventType === 'charge.success') {
      const metadata = eventData.data.metadata || {};
      const orderId = metadata.orderId;
      const orderData = JSON.parse(metadata.orderData || '{}');

      // Update order status (via GitHub API if available)
      if (process.env.GITHUB_TOKEN) {
        try {
          const repo = 'sanmmie/priceless-stones';
          const path = 'netlify/functions/orders.json';

          const getCurrent = await axios.get(`https://api.github.com/repos/${repo}/contents/${path}`, {
            headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          });

          const orders = JSON.parse(Buffer.from(getCurrent.data.content, 'base64').toString());
          const orderIdx = orders.findIndex(o => o.id === orderId);

          if (orderIdx !== -1) {
            orders[orderIdx].status = 'paid';
            orders[orderIdx].paymentMethod = 'Paystack';
            orders[orderIdx].paidAt = new Date().toISOString();

            await axios.put(`https://api.github.com/repos/${repo}/contents/${path}`, {
              message: `Update order ${orderId} to paid`,
              content: Buffer.from(JSON.stringify(orders, null, 2)).toString('base64'),
              sha: getCurrent.data.sha
            }, {
              headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            });
          }
        } catch {
          // Update failed (non-critical)
        }
      }

      // Send confirmation WhatsApp message
      const whatsappNumber = process.env.WHATSAPP_NUMBER || '2347036207517';
      const confirmMessage =
        `*ORDER PAID!*%0A` +
        `*Order ID:* ${orderId}%0A` +
        `*Amount:* ₦${(eventData.data.amount / 100).toLocaleString()}%0A` +
        `*Status:* Paid - Ready for processing%0A%0A` +
        `Thank you for your order!`;

      try {
        await axios.get(`https://wa.me/${whatsappNumber}?text=${confirmMessage}`, { timeout: 5000 });
      } catch {}
    }

    if (eventType === 'charge.failed') {
      const metadata = eventData.data.metadata || {};
      const orderId = metadata.orderId;

      if (process.env.GITHUB_TOKEN) {
        try {
          const repo = 'sanmmie/priceless-stones';
          const path = 'netlify/functions/orders.json';

          const getCurrent = await axios.get(`https://api.github.com/repos/${repo}/contents/${path}`, {
            headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          });

          const orders = JSON.parse(Buffer.from(getCurrent.data.content, 'base64').toString());
          const orderIdx = orders.findIndex(o => o.id === orderId);

          if (orderIdx !== -1) {
            orders[orderIdx].status = 'payment_failed';

            await axios.put(`https://api.github.com/repos/${repo}/contents/${path}`, {
              message: `Update order ${orderId} to payment_failed`,
              content: Buffer.from(JSON.stringify(orders, null, 2)).toString('base64'),
              sha: getCurrent.data.sha
            }, {
              headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            });
          }
        } catch {}
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook processing failed', message: error.message })
    };
  }
};
