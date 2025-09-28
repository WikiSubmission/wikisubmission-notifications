import { supabase } from "./supabase-client";

export interface NotificationReceiver {
    device_token: string;
    platform: 'ios';
    last_notification_sent_at: string;
    prayer_notifications: boolean;
    daily_verse_notifications: boolean;
    daily_chapter_notifications: boolean;
}

export async function getReceivers(): Promise<NotificationReceiver[]> {
    try {
        const { data, error } = await supabase().from('ws-notifications').select('*');

        if (error) {
            console.error(`Error getting receivers: ${error.message}`);
            return [];
        }

        if (!data || data.length === 0) {
            console.log('No receivers found');
            return [];
        }

        console.log(`Found ${data.length} receivers`);
        return data as NotificationReceiver[];
    } catch (error) {
        console.error('Exception in getReceivers:', error);
        return [];
    }
}