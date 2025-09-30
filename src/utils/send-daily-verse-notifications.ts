import type { NotificationReceiver } from "../types/notification-receiver";
import { generateDailyVerseNotification } from "../notification-generators/daily-verse";
import { sendIOSNotification } from "./send-ios-notification";
import { supabase } from "./supabase-client";

export async function sendDailyVerseNotifications(receiver: NotificationReceiver) {

    const dailyVerse = await generateDailyVerseNotification(receiver);

    if (dailyVerse) {
        try {
            await sendIOSNotification(receiver.device_token, dailyVerse);

            await supabase()
                .from('ws-notifications-daily-verse')
                .update({
                    last_notification_sent_at: new Date().toISOString()
                })
                .eq('device_token', receiver.device_token);
        } catch (error) {
            console.error(`Error sending daily verse notification to ${receiver.device_token}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

}
