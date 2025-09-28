import { WikiSubmission } from "wikisubmission-sdk";
import { sendIOSNotification } from "./send-ios-notification";
import { supabase } from "./supabase-client";
import type { NotificationReceiver } from "../types/notification-receiver";

export async function sendDailyVerseNotifications(receiver: NotificationReceiver) {

    const { data, error } = await supabase().from('ws-notifications-daily-verse')
        .select('*')
        .eq('device_token', receiver.device_token)
        .single();

    if (error) {
        console.error(`Error getting daily verse notifications for receiver ${receiver.device_token}: ${error.message}`);
    }

    if (!data || data.length === 0) {
        // Silently return - this is normal
        return;
    }

    const { last_notification_sent_at } = data;

    if (last_notification_sent_at && new Date(last_notification_sent_at) > new Date(Date.now() - 1000 * 60 * 60 * 24)) return;

    const ws = WikiSubmission.Quran.V1.createAPIClient();
    const verseOfTheDay = await ws.getRandomVerse();

    if (verseOfTheDay instanceof Error) {
        console.error(`Error getting daily verse for receiver ${receiver.device_token}: ${verseOfTheDay.message}`);
        return;
    }

    if (verseOfTheDay.response.length === 0) {
        console.error(`No daily verse found for receiver ${receiver.device_token}`);
        return;
    }

    const verse = verseOfTheDay.response[0];

    await sendIOSNotification({
        deviceToken: receiver.device_token,
        title: `Daily Verse`,
        body: `[${verse?.verse_id}] ${verse?.verse_text_english}`,
        category: 'DAILY_VERSE_NOTIFICATION',
        threadId: 'daily-verse',
        deepLink: `wikisubmission://verse/${verse?.verse_id}`,
        custom: {
            verse_id: verse?.verse_id,
            chapter_number: verse?.chapter_number,
            verse_number: verse?.verse_number,
        }
    });

    await supabase().from('ws-notifications').update({
        last_notification_sent_at: new Date().toISOString()
    }).eq('device_token', receiver.device_token);

    await supabase().from('ws-notifications-daily-verse').update({
        last_notification_sent_at: new Date().toISOString()
    }).eq('device_token', receiver.device_token);
}
