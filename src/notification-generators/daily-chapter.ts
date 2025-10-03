import type { NotificationContent } from "../types/notification-content";
import type { Notification } from "../types/notification";
import { WikiSubmission } from "wikisubmission-sdk";
import { supabase } from "../utils/supabase-client";

export async function generateDailyChapterNotification(receiver: Notification, force: boolean = false): Promise<NotificationContent | null> { 

    if (!receiver.daily_chapter_notifications?.enabled && !force) return null;

    const { data, error } = await supabase().from('ws-notifications')
        .select('*')
        .eq('device_token', receiver.device_token)
        .single();

    if (error) {
        console.error(`Error getting daily chapter notifications for receiver ${receiver.device_token}: ${error.message}`);
        return null;
    }

    if (!data) {
        return null;
    }

    // Check if daily chapter sent in last 24 hours.
    const { daily_chapter_notifications } = data;
    if (daily_chapter_notifications?.last_delivery_at && new Date(daily_chapter_notifications?.last_delivery_at) > new Date(Date.now() - 1000 * 60 * 60 * 24) && !force) return null;

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
        metadata: {
            chapter_number: verse.response[0]?.chapter_number,
            verse_id: verse.response[0]?.verse_id,
        },
    };
}