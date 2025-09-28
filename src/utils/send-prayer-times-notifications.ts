import type { NotificationReceiver } from "../types/notification-receiver";
import { generatePrayerTimesNotification } from "../notification-generators/prayer-times";
import { sendIOSNotification } from "./send-ios-notification";
import { supabase } from "./supabase-client";

export async function sendPrayerTimesNotifications(receiver: NotificationReceiver) {

    const prayerTimes = await generatePrayerTimesNotification(receiver);

    if (prayerTimes) {
        await sendIOSNotification(receiver.device_token, prayerTimes);

        await supabase().from('ws-notifications').update({
            last_notification_sent_at: new Date().toISOString()
        }).eq('device_token', receiver.device_token);

        await supabase().from('ws-notifications-prayer-times').update({
            last_notification_sent_at: new Date().toISOString()
        }).eq('device_token', receiver.device_token);
    }
}