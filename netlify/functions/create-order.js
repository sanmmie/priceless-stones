exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

    try {
        const order = JSON.parse(event.body);
        if (!order || typeof order !== 'object') {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid order data' }) };
        }
        if (!order.name || typeof order.name !== 'string' || order.name.length > 100) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid name' }) };
        }
        if (!order.email || typeof order.email !== 'string' || !order.email.includes('@')) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email' }) };
        }

        const orderId = 'DPS-' + Date.now().toString(36).toUpperCase();
    const timestamp = new Date().toISOString();

    const fullOrder = {
      ...order,
      id: orderId,
      date: timestamp.split('T')[0],
      time: timestamp.split('T')[1].split('.')[0],
      status: 'pending',
      createdAt: timestamp
    };

    // Send WhatsApp notification (optional - requires WhatsApp Business API)
    const whatsappNumber = process.env.WHATSAPP_NUMBER || '2347036207517';
    const orderMessage =
      `*NEW ORDER #${orderId}*%0A` +
      `*Name:* ${order.name}%0A` +
      `*Email:* ${order.email}%0A` +
      `*Phone:* ${order.phone || 'N/A'}%0A` +
      `*Type:* ${order.orderType || 'Custom'}%0A` +
      `*Item:* ${order.item || 'N/A'}%0A` +
      `*Total:* ₦${order.total?.toLocaleString?.() || 'N/A'}%0A` +
      `*Status:* ${fullOrder.status}%0A%0A` +
      `*Description:*%0A${order.description || 'N/A'}%0A%0A` +
      `Review at: https://pricelessstones.netlify.app/admin.html`;

    try {
      const whRes = await fetch(`https://wa.me/${whatsappNumber}?text=${orderMessage}`, { signal: AbortSignal.timeout(5000) });
    } catch {
      // WhatsApp notification failed (non-critical)
    }

    // Try to store order in repo via GitHub API
    if (process.env.GITHUB_TOKEN) {
      try {
        const repo = 'sanmmie/priceless-stones';
        const path = 'netlify/functions/orders.json';

        const getCurrent = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
          headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        });
        const currentData = await getCurrent.json();

        const currentOrders = JSON.parse(Buffer.from(currentData.content, 'base64').toString());
        currentOrders.push(fullOrder);

        await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Add order ${orderId}`,
            content: Buffer.from(JSON.stringify(currentOrders, null, 2)).toString('base64'),
            sha: currentData.sha
          })
        });
      } catch {
        // GitHub storage failed (non-critical, order still processed)
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, orderId, message: 'Order created successfully' })
    };
  } catch (error) {
    console.error('Create order error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to create order' })
    };
  }
};
