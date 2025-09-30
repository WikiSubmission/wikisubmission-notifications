import type { NotificationContent } from "../types/notification-content";
import type { NotificationReceiver } from "../types/notification-receiver";
import { WikiSubmission } from "wikisubmission-sdk";
import { supabase } from "../utils/supabase-client";

export async function generateDailyChapterNotification(receiver: NotificationReceiver, force: boolean = false): Promise<NotificationContent | null> { 

    const { data, error } = await supabase().from('ws-notifications-daily-chapter')
        .select('*')
        .eq('device_token', receiver.device_token)
        .single();

    if (error) {
        console.error(`Error getting daily chapter notifications for receiver ${receiver.device_token}: ${error.message}`);
        return null;
    }

    if (!data || data.length === 0) {
        return null;
    }

    // Check if daily chapter sent in last 24 hours.
    const { last_notification_sent_at } = data;
    if (last_notification_sent_at && new Date(last_notification_sent_at) > new Date(Date.now() - 1000 * 60 * 60 * 24) && !force) return null;

    const ws = WikiSubmission.Quran.V1.createAPIClient();
    const verse = await ws.getRandomChapter();

    if (verse instanceof Error) {
        console.error(verse.message);
        return null;
    }

    return {
        title: `Daily Chapter`,
        body: `Sura ${verse.response[0]?.chapter_number}, ${verse.response[0]?.chapter_title_english}. Click to read now.`,
        category: 'DAILY_CHAPTER',
        threadId: 'daily-chapter',
        deepLink: `wikisubmission://chapter/${verse.response[0]?.chapter_number}`,
        expirationHours: 24,
        custom: {
            chapter_number: verse.response[0]?.chapter_number,
        },
    };
}