import http2 from 'http2';
import jwt from 'jsonwebtoken';
import { NotificationContent } from '../types/notification-content';
import { NotificationOptions } from '../types/notification-options';
import { supabase } from './supabase-client';
import { createUpdateData } from './notification-timing';
import { NotificationCategory } from '../types/notification-categories';

export async function sendIOSNotification(
  deviceToken: string,
  notification: NotificationContent,
  options?: NotificationOptions
) {
  let client: http2.ClientHttp2Session | undefined;
  const currentEnv = process.env['APNS_ENV'] || 'sandbox';

  try {
    const token = createApnsJwt();

    client = http2.connect(
      currentEnv === 'production'
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
            const now = new Date().toISOString();
            
            // Determine category and create appropriate update data
            let category: NotificationCategory;
            if (notification.category === 'DAILY_VERSE') {
              category = 'daily_verse';
            } else if (notification.category === 'DAILY_CHAPTER') {
              category = 'daily_chapter';
            } else if (notification.category === 'PRAYER_TIMES') {
              category = 'prayer_times';
            } else {
              // Fallback for unknown categories - just update root-level
              await supabase()
                .from('ws-notifications')
                .upsert({
                  device_token: deviceToken,
                  last_delivery_at: now
                }, {
                  onConflict: 'device_token',
                  ignoreDuplicates: false
                });
              return;
            }

            const updateData = createUpdateData(category, now);

            await supabase()
              .from('ws-notifications')
              .upsert({
                device_token: deviceToken,
                ...updateData
              }, {
                onConflict: 'device_token',
                ignoreDuplicates: false
              });
          } catch (error) {
            console.error(`Error updating last notification sent at for ${deviceToken}: ${error instanceof Error ? error.message : String(error)}`);
          }

          resolve({ responseBody: data, statusCode });
        } else {
            console.error(`Notification delivery failed to ${deviceToken} (${statusCode})`);
            console.error(`Response: ${data}`);
            
            // Try alternative environment before giving up
            try {
              const alternativeResult = await tryAlternativeEnvironment(
                deviceToken,
                notification,
                options,
                currentEnv
              );
              
              if (alternativeResult.success) {
                console.log(`✅ Fallback to alternative environment succeeded for ${deviceToken?.slice(0, 5) + '...'}`);
                
                // Update database with successful delivery
                try {
                  const now = new Date().toISOString();
                  
                  // Determine category and create appropriate update data
                  let category: NotificationCategory;
                  if (notification.category === 'DAILY_VERSE') {
                    category = 'daily_verse';
                  } else if (notification.category === 'DAILY_CHAPTER') {
                    category = 'daily_chapter';
                  } else if (notification.category === 'PRAYER_TIMES') {
                    category = 'prayer_times';
                  } else {
                    // Fallback for unknown categories - just update root-level
                    await supabase()
                      .from('ws-notifications')
                      .upsert({
                        device_token: deviceToken,
                        last_delivery_at: now
                      }, {
                        onConflict: 'device_token',
                        ignoreDuplicates: false
                      });
                    resolve({ responseBody: alternativeResult.responseBody, statusCode: alternativeResult.statusCode });
                    return;
                  }

                  const updateData = createUpdateData(category, now);

                  await supabase()
                    .from('ws-notifications')
                    .upsert({
                      device_token: deviceToken,
                      ...updateData
                    }, {
                      onConflict: 'device_token',
                      ignoreDuplicates: false
                    });
                } catch (error) {
                  console.error(`Error updating last notification sent at for ${deviceToken}: ${error instanceof Error ? error.message : String(error)}`);
                }
                
                resolve({ responseBody: alternativeResult.responseBody, statusCode: alternativeResult.statusCode });
                return;
              }
            } catch (fallbackError) {
              console.error(`Fallback attempt failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
            }
            
            // Parse response to check for BadDeviceToken
            try {
              const responseData = JSON.parse(data);
              if (responseData?.reason === 'BadDeviceToken') {
                console.log(`🗑️ Deleting device token ${deviceToken?.slice(0, 5) + '...'} after both environments failed`);
                // If so, delete the device token from the database.
                await supabase()
                  .from('ws-notifications')
                  .delete()
                  .eq('device_token', deviceToken);
              }
            } catch (parseError) {
              console.error(`Error parsing APNs response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
            }
            
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

async function tryAlternativeEnvironment(
  deviceToken: string,
  notification: NotificationContent,
  options: NotificationOptions | undefined,
  originalEnv: string
): Promise<{ success: boolean; responseBody?: string; statusCode?: number; error?: string }> {
  const alternativeEnv = originalEnv === 'production' ? 'sandbox' : 'production';
  console.log(`🔄 Trying alternative environment: ${alternativeEnv}`);
  
  let client: http2.ClientHttp2Session | undefined;
  
  try {
    const token = createApnsJwt();
    
    client = http2.connect(
      alternativeEnv === 'production'
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

    return new Promise((resolve) => {
      let data = '';
      let statusCode: number | undefined;

      const req = client!.request(headers);
      req.setEncoding('utf8');
      req.on('response', (headers) => {
        statusCode = headers[':status'] as number;
      });
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => {
        client?.close();
        if (statusCode === 200) {
          console.log(`✅ Alternative environment (${alternativeEnv}) succeeded for ${deviceToken?.slice(0, 5) + '...'}`);
          resolve({ success: true, responseBody: data, statusCode });
        } else {
          console.log(`❌ Alternative environment (${alternativeEnv}) also failed with status ${statusCode}`);
          resolve({ 
            success: false, 
            responseBody: data, 
            statusCode: statusCode || 0, 
            error: `Status ${statusCode || 'unknown'}: ${data}` 
          });
        }
      });
      req.on('error', (err) => {
        client?.close();
        console.log(`❌ Alternative environment (${alternativeEnv}) network error: ${err.message}`);
        resolve({ success: false, error: `Network error: ${err.message}` });
      });
      req.end(bodyString);
    });
  } catch (err) {
    client?.close();
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.log(`❌ Alternative environment (${alternativeEnv}) exception: ${errorMessage}`);
    return { success: false, error: `Exception: ${errorMessage}` };
  }
}