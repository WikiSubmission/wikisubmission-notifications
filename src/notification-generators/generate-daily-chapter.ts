import type { NotificationContent } from "../types/notification-content";
import type { Notification } from "../types/notification";
import { supabase } from "../utils/supabase-client";
import { shouldBlockNotification } from "../utils/notification-timing";
import { ws } from "../utils/wikisubmission-sdk";

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

    // Check if daily chapter sent in last 24 hours (category-specific timing)
    if (shouldBlockNotification(data, 'daily_chapter', force)) {
        return null;
    }

    const chapter = await ws.Quran.randomChapter();

    if (chapter.error) {
        console.error(chapter.error.message);
        return null;
    }

    return {
        title: `Daily Chapter`,
        body: `Sura ${chapter.data.chapter_number}, ${chapter.data.ws_quran_chapters.title_english}. Click to read now.`,
        category: 'DAILY_CHAPTER',
        threadId: 'daily-chapter',
        deepLink: `wikisubmission://chapter/${chapter.data.chapter_number}`,
        expirationHours: 24,
        metadata: {
            chapter_number: chapter.data.chapter_number,
            verse_id: chapter.data.verse_id,
        },
    };
}