import http2 from 'http2';
import jwt from 'jsonwebtoken';
import { NotificationContent } from '../types/notification-content';
import { NotificationOptions } from '../types/notification-options';
import { supabase } from './supabase-client';

export async function sendIOSNotification(
  deviceToken: string,
  notification: NotificationContent,
  options?: NotificationOptions
) {
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
      'apns-expiration': `${Math.floor(Date.now() / 1000) + notification.expirationHours * 3600}`,
    };

    // Construct sound object for critical alerts or use simple string
    let soundValue: any = options?.sound || 'default';
    if (options?.critical) {
      soundValue = {
        critical: 1,
        name: options?.sound || 'default',
        volume: options?.volume || 1.0
      };
    }

    const payload: Record<string, any> = {
      aps: {
        alert: { title: notification.title, body: notification.body },
        sound: soundValue,
        badge: 1,
      },
      ...notification.metadata,
    };

    if (notification.category) payload['aps'].category = notification.category;
    if (notification.threadId) payload['aps']['thread-id'] = notification.threadId;

    if (notification.deepLink) {
      payload['deepLink'] = notification.deepLink;
      payload['url'] = notification.deepLink;
    }

    const bodyString = JSON.stringify(payload);

    // Log sending attempt
    console.log(`📤 Sending notification to ${deviceToken.slice(0, 5) + '...'}`);

    const req = client.request(headers);

    return new Promise((resolve, reject) => {
      let data = '';
      let statusCode: number | undefined;

      req.setEncoding('utf8');
      req.on('response', (headers) => {
        statusCode = headers[':status'] as number;
      });
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', async () => {
        client?.close();

        // Log delivery status and throw error for non-200 status codes
        if (statusCode === 200) {
          console.log(`✅ Notification delivered successfully to ${deviceToken?.slice(0, 5) + '...'} (${notification.category})`);

          try {
            await supabase()
              .from('ws-notifications')
              .update({
                last_delivery_at: new Date().toISOString(),
                ...(notification.category === 'DAILY_VERSE' && {
                  daily_verse_notifications: {
                    last_delivery_at: new Date().toISOString()
                  }
                }),
                ...(notification.category === 'DAILY_CHAPTER' && {
                  daily_chapter_notifications: {
                    last_delivery_at: new Date().toISOString()
                  }
                }),
                ...(notification.category === 'PRAYER_TIMES' && {
                  prayer_time_notifications: {
                    last_delivery_at: new Date().toISOString()
                  }
                }),
              })
              .eq('device_token', deviceToken);
          } catch (error) {
            console.error(`Error updating last notification sent at for ${deviceToken}: ${error instanceof Error ? error.message : String(error)}`);
          }

          resolve({ responseBody: data, statusCode });

        } else {
          console.error(`Notification delivery failed to ${deviceToken} (${statusCode})`);
          console.error(`Response: ${data}`);
          reject(new Error(`Notification delivery failed with status ${statusCode}: ${data}`));
        }
      });
      req.on('error', (err) => {
        client?.close();
        console.error(`Network error sending notification to ${deviceToken}:`, err.message);
        reject(new Error(`Network error sending notification: ${err.message}`));
      });
      req.end(bodyString);
    });
  } catch (err) {
    client?.close();
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Exception sending notification to ${deviceToken}:`, errorMessage);
    throw new Error(`Exception sending notification: ${errorMessage}`);
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