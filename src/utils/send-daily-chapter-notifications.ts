import type { NotificationReceiver } from "../types/notification-receiver";
import { generateDailyChapterNotification } from "../notification-generators/daily-chapter";
import { sendIOSNotification } from "./send-ios-notification";
import { supabase } from "./supabase-client";

export async function sendDailyChapterNotifications(receiver: NotificationReceiver) {

    const dailyChapter = await generateDailyChapterNotification(receiver);

    if (dailyChapter) { 
        await sendIOSNotification(receiver.device_token, dailyChapter);

        await supabase().from('ws-notifications').update({
            last_notification_sent_at: new Date().toISOString()
        }).eq('device_token', receiver.device_token);
    
        await supabase().from('ws-notifications-daily-chapter').update({
            last_notification_sent_at: new Date().toISOString()
        }).eq('device_token', receiver.device_token);
    }
}
