import type { NotificationReceiver } from "../types/notification-receiver";
import type { NotificationContent } from "../types/notification-content";
import { supabase } from "../utils/supabase-client";

export async function generatePrayerTimesNotification(receiver: NotificationReceiver): Promise<NotificationContent | null> {

    const { data, error } = await supabase().from('ws-notifications-prayer-times')
        .select('*')
        .eq('device_token', receiver.device_token)
        .single();

    if (error) {
        console.error(`Error getting prayer times notifications for receiver ${receiver.device_token}: ${error.message}`);
    }

    if (!data || data.length === 0) {
        // Silently return - this is normal
        return null;
    }

    const { location, fajr, dhuhr, asr, maghrib, isha, use_midpoint_method_for_asr, last_notification_sent_at } = data;

    if (!location) return null;
    if (!fajr && !dhuhr && !asr && !maghrib && !isha) {
        await supabase().from('ws-notifications').update({
            prayer_times_notifications: false
        }).eq('device_token', receiver.device_token);
        return null;
    }
    if (last_notification_sent_at && new Date(last_notification_sent_at) > new Date(Date.now() - 1000 * 60 * 24)) return null;

    const prayerTimes = await fetch(`https://practices.wikisubmission.org/prayer-times/${location}?device_token=${receiver.device_token}&platform=${receiver.platform}${use_midpoint_method_for_asr ? '&asr_adjustment=true' : ''}`);

    if (!prayerTimes.ok) {
        console.error(`Error getting prayer times for receiver ${receiver.device_token}: ${prayerTimes.statusText}`);
        return null;
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
        return null;
    }

    if (prayerTimesData.current_prayer === "fajr" && !fajr) return null;
    if (prayerTimesData.current_prayer === "dhuhr" && !dhuhr) return null;
    if (prayerTimesData.current_prayer === "asr" && !asr) return null;
    if (prayerTimesData.current_prayer === "maghrib" && !maghrib) return null;
    if (prayerTimesData.current_prayer === "isha" && !isha) return null;

    if (prayerTimesData.upcoming_prayer_time_left === "10m" || prayerTimesData.upcoming_prayer_time_left.length === 2) { 
        return {
            title: `${capitalize(prayerTimesData.upcoming_prayer)} starting soon!`,
            body: `${prayerTimesData.upcoming_prayer_time_left} left (${prayerTimesData.times[prayerTimesData.upcoming_prayer as keyof typeof prayerTimesData.times]})`,
            category: 'PRAYER_TIMES',
            threadId: 'prayer',
            deepLink: `wikisubmission://prayer-times`,
            expirationHours: 24,
        };
    }

    return null;
}

function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}