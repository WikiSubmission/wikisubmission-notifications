import http2 from 'http2';
import jwt from 'jsonwebtoken';

export async function sendIOSNotification({
  deviceToken,
  title,
  body,
  category,
  threadId,
  expirationHours = 1,
  deepLink,
  custom,
}: {
  deviceToken: string;
  title: string;
  body: string;
  category?: string;
  threadId?: string;
  expirationHours?: number;
  deepLink?: string;
  custom?: Record<string, any>;
}) {
  let client: http2.ClientHttp2Session | undefined;

  try {
    const token = createApnsJwt();

    client = http2.connect(
      process.env['APNS_ENV'] === 'production'
        ? 'https://api.push.apple.com'
        : 'https://api.sandbox.push.apple.com'
    );

    const headers: Record<string, string> = {
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      'apns-topic': process.env['APNS_BUNDLE_ID']!,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'authorization': `bearer ${token}`,
      'apns-expiration': `${Math.floor(Date.now() / 1000) + expirationHours * 3600}`,
    };

    const payload: Record<string, any> = {
      aps: {
        alert: { title, body },
        sound: 'default',
        badge: 1,
      },
      ...custom,
    };

    if (category) payload['aps'].category = category;
    if (threadId) payload['aps']['thread-id'] = threadId;
    
    if (deepLink) {
      payload['deepLink'] = deepLink;
      payload['url'] = deepLink;
    }

    const bodyString = JSON.stringify(payload);
    
    // Log sending attempt
    console.log(`📤 Sending notification to ${deviceToken}...`);
    console.log(`   Title: ${title}`);
    if (deepLink) console.log(`   Deep Link: ${deepLink}`);
    
    const req = client.request(headers);

    return new Promise((resolve) => {
      let data = '';
      let statusCode: number | undefined;

      req.setEncoding('utf8');
      req.on('response', (headers) => {
        statusCode = headers[':status'] as number;
      });
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => {
        client?.close();
        
        // Log delivery status
        if (statusCode === 200) {
          console.log(`✅ Notification delivered successfully to ${deviceToken}`);
          console.log(`Title: ${title}`);
          console.log(`Category: ${category || 'none'}`);
        } else {
          console.error(`Notification delivery failed to ${deviceToken} (${statusCode})`);
          console.error(`Response: ${data}`);
        }
        
        resolve({ responseBody: data, statusCode });
      });
      req.on('error', (err) => {
        client?.close();
        console.error(`Network error sending notification to ${deviceToken}:`, err.message);
        resolve({ error: err });
      });
      req.end(bodyString);
    });
  } catch (err) {
    client?.close();
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Exception sending notification to ${deviceToken}:`, errorMessage);
    return { error: errorMessage };
  }
}

function createApnsJwt(): string {
  const { APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY } = process.env;

  if (!APNS_TEAM_ID || !APNS_KEY_ID || !APNS_PRIVATE_KEY) {
    throw new Error('Missing APNs credentials in environment variables.');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: APNS_TEAM_ID, iat: now };

  let privateKey = APNS_PRIVATE_KEY;
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
    if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
      privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
    }
  }

  return jwt.sign(payload, privateKey, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: APNS_KEY_ID, typ: 'JWT' },
  });
}