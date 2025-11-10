import type { NotificationContent } from "../types/notification-content";
import type { Notification } from "../types/notification";
import { supabase } from "../utils/supabase-client";
import { shouldBlockNotification } from "../utils/notification-timing";
import { ws } from "../utils/wikisubmission-sdk";

export async function generateDailyVerseNotification(receiver: Notification, force: boolean = false): Promise<NotificationContent | null> {

    if (!receiver.daily_verse_notifications?.enabled && !force) return null;

    const { data, error } = await supabase().from('ws-notifications')
        .select('*')
        .eq('device_token', receiver.device_token)
        .single();

    if (error) {
        console.error(`Error getting daily verse notifications for receiver ${receiver.device_token}: ${error.message}`);
        return null;
    }

    if (!data) {
        return null;
    }

    // Check if daily verse sent in last 24 hours (category-specific timing)
    if (shouldBlockNotification(data, 'daily_verse', force)) {
        return null;
    }

    const verse = await ws.Quran.randomVerse();

    if (verse.error) {
        console.error(verse.error.message);
        return null;
    }

    return {
        title: `Daily Verse`,
        body: `[${verse.data.verse_id}] ${verse.data.ws_quran_text.english}`,
        category: 'DAILY_VERSE',
        threadId: 'daily-verse',
        deepLink: `wikisubmission://verse/${verse.data.verse_id}`,
        expirationHours: 24,
        metadata: {
            chapter_number: verse.data.chapter_number,
            verse_id: verse.data.verse_id,
        },
    };
}