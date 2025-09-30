import type { NotificationReceiver } from "../types/notification-receiver";
import { generateDailyChapterNotification } from "../notification-generators/daily-chapter";
import { sendIOSNotification } from "./send-ios-notification";
import { supabase } from "./supabase-client";

export async function sendDailyChapterNotifications(receiver: NotificationReceiver) {

    const dailyChapter = await generateDailyChapterNotification(receiver);

    if (dailyChapter) {
        try {
            await sendIOSNotification(receiver.device_token, dailyChapter);

            await supabase()
                .from('ws-notifications-daily-chapter')
                .update({
                    last_notification_sent_at: new Date().toISOString()
                })
                .eq('device_token', receiver.device_token);
        } catch (error) {
            console.error(`Error sending daily chapter notification to ${receiver.device_token}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
