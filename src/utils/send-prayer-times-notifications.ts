import { NotificationReceiver } from "../types/notification-receiver";
import { sendIOSNotification } from "./send-ios-notification";
import { supabase } from "./supabase-client";

export async function sendPrayerTimesNotifications(receiver: NotificationReceiver) {

    const { data, error } = await supabase().from('ws-notifications-prayer-times')
        .select('*')
        .eq('device_token', receiver.device_token)
        .single();

    if (error) {
        console.error(`Error getting prayer times notifications for receiver ${receiver.device_token}: ${error.message}`);
    }

    if (!data || data.length === 0) {
        console.log(`No prayer times notifications found for receiver ${receiver.device_token}`);
        return;
    }

    const { location, fajr, dhuhr, asr, maghrib, isha, use_midpoint_method_for_asr, last_notification_sent_at } = data;

    if (!location) return;
    if (!fajr && !dhuhr && !asr && !maghrib && !isha) {
        await supabase().from('ws-notifications').update({
            prayer_times_notifications: false
        }).eq('device_token', receiver.device_token);
        return;
    }
    if (last_notification_sent_at && new Date(last_notification_sent_at) > new Date(Date.now() - 1000 * 60 * 24)) return;

    const prayerTimes = await fetch(`https://practices.wikisubmission.org/prayer-times/${location}?device_token=${receiver.device_token}&platform=${receiver.platform}${use_midpoint_method_for_asr ? '&asr_adjustment=true' : ''}`);

    if (!prayerTimes.ok) {
        console.error(`Error getting prayer times for receiver ${receiver.device_token}: ${prayerTimes.statusText}`);
        return;
    }

    const prayerTimesData = await prayerTimes.json() as {
        times: {
            fajr: string;
            dhuhr: string;
            asr: string;
            maghrib: string;
            isha: string;
            sunrise: string;
            sunset: string;
        };
        current_prayer: string;
        upcoming_prayer: string;
        current_prayer_time_elapsed: string;
        upcoming_prayer_time_left: string;
    };

    if (!prayerTimesData || !prayerTimesData.times || !prayerTimesData.current_prayer || !prayerTimesData.upcoming_prayer || !prayerTimesData.current_prayer_time_elapsed || !prayerTimesData.upcoming_prayer_time_left) {
        console.error(`Error getting prayer times for receiver ${receiver.device_token}: ${prayerTimes.statusText}`);
        return;
    }

    if (prayerTimesData.current_prayer === "fajr" && !fajr) return;
    if (prayerTimesData.current_prayer === "dhuhr" && !dhuhr) return;
    if (prayerTimesData.current_prayer === "asr" && !asr) return;
    if (prayerTimesData.current_prayer === "maghrib" && !maghrib) return;
    if (prayerTimesData.current_prayer === "isha" && !isha) return;

    if (prayerTimesData.upcoming_prayer_time_left === "10m" || prayerTimesData.upcoming_prayer_time_left.length === 2) {
        const deepLink = `wikisubmission://prayer-times`;
        
        await sendIOSNotification({
            deviceToken: receiver.device_token,
            title: `${capitalize(prayerTimesData.upcoming_prayer)} in ${prayerTimesData.upcoming_prayer_time_left}`,
            body: `At ${prayerTimesData.times[prayerTimesData.upcoming_prayer as keyof typeof prayerTimesData.times]}`,
            category: 'PRAYER_NOTIFICATION',
            threadId: 'prayer',
            deepLink: deepLink,
        });

        await supabase().from('ws-notifications').update({
            last_notification_sent_at: new Date().toISOString()
        }).eq('device_token', receiver.device_token);

        await supabase().from('ws-notifications-prayer-times').update({
            last_notification_sent_at: new Date().toISOString()
        }).eq('device_token', receiver.device_token);
    }

    return true;
}

function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}