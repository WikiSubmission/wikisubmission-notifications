import type { Notification } from "../types/notification";
import type { NotificationContent } from "../types/notification-content";
import { supabase } from "../utils/supabase-client";

export async function generatePrayerTimesNotification(receiver: Notification, force: boolean = false): Promise<NotificationContent | null> {

    if (!receiver?.prayer_time_notifications?.enabled && !force) return null;

    const { data, error } = await supabase().from('ws-notifications')
        .select('*')
        .eq('device_token', receiver.device_token)
        .single();

    if (error) {
        console.error(`Error getting prayer time notifications for receiver ${receiver.device_token}: ${error.message}`);
        return null;
    }

    if (!data) {
        return null;
    }

    const { prayer_time_notifications } = data;
    const { location, fajr, dhuhr, asr, maghrib, isha, use_midpoint_method_for_asr } = prayer_time_notifications?.customization || {};

    if (!location) return null;
    if (!fajr && !dhuhr && !asr && !maghrib && !isha) {
        await supabase().from('ws-notifications')
            .update({
                prayer_time_notifications: {
                    enabled: false
                }
            })
            .eq('device_token', receiver.device_token);
        return null;
    }
    if (prayer_time_notifications?.last_delivery_at && new Date(prayer_time_notifications?.last_delivery_at) > new Date(Date.now() - 1000 * 60 * 60) && !force) return null;

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

    if (prayerTimesData.upcoming_prayer === "sunrise") return null;

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