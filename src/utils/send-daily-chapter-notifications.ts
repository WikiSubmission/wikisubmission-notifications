import { NotificationReceiver } from "./get-receivers";
import { WikiSubmission } from "wikisubmission-sdk";
import { sendIOSNotification } from "./send-ios-notification";
import { supabase } from "./supabase-client";

export async function sendDailyChapterNotifications(receiver: NotificationReceiver) {

    const { data, error } = await supabase().from('ws-notifications-daily-chapter')
        .select('*')
        .eq('device_token', receiver.device_token)
        .single();

    if (error) {
        console.error(`Error getting daily chapter notifications for receiver ${receiver.device_token}: ${error.message}`);
    }

    if (!data || data.length === 0) {
        console.log(`No daily chapter notifications found for receiver ${receiver.device_token}`);
        return;
    }

    const { last_notification_sent_at } = data;

    if (last_notification_sent_at && new Date(last_notification_sent_at) > new Date(Date.now() - 1000 * 60 * 60 * 24)) return;

    const ws = WikiSubmission.Quran.V1.createAPIClient();
    const randomChapter = await ws.getRandomChapter();

    if (randomChapter instanceof Error) {
        console.error(`Error getting daily chapter for receiver ${receiver.device_token}: ${randomChapter.message}`);
        return;
    }

    if (randomChapter.response.length === 0) {
        console.error(`No daily chapter found for receiver ${receiver.device_token}`);
        return;
    }

    const chapter = randomChapter.response[0];
    
    await sendIOSNotification({
        deviceToken: receiver.device_token,
        title: `Daily Chapter`,
        body: `Sura ${chapter?.chapter_number}, ${chapter?.chapter_title_english} (${chapter?.chapter_title_transliterated}). Click to read now.`,
        category: 'DAILY_CHAPTER_NOTIFICATION',
        threadId: 'daily-chapter',
        deepLink: `wikisubmission://chapter/${chapter?.chapter_number}`,
        custom: {
            chapter_number: chapter?.chapter_number
        }
    });

    await supabase().from('ws-notifications').update({
        last_notification_sent_at: new Date().toISOString()
    }).eq('device_token', receiver.device_token);

    await supabase().from('ws-notifications-daily-chapter').update({
        last_notification_sent_at: new Date().toISOString()
    }).eq('device_token', receiver.device_token);
}
