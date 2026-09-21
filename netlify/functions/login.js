const crypto = require('crypto');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { password } = JSON.parse(event.body);
        if (!password || typeof password !== 'string' || password.length > 256) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid password' }) };
        }

        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminPassword) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Server configuration error' })
            };
        }

        const inputHash = crypto.createHash('sha256').update(password).digest('hex');
        const expectedHash = crypto.createHash('sha256').update(adminPassword).digest('hex');

        if (inputHash === expectedHash) {
            const token = crypto.randomBytes(32).toString('hex');
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, token, expires: Date.now() + 30 * 60 * 1000 })
            };
        }

        return { statusCode: 401, body: JSON.stringify({ error: 'Invalid password' }) };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Authentication failed' }) };
    }
};
