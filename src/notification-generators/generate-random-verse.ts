import type { NotificationContent } from "../types/notification-content";
import { ws } from "../utils/wikisubmission-sdk";

export async function generateRandomVerseNotification(): Promise<NotificationContent | null> {

    const verse = await ws.Quran.randomVerse();

    if (verse.error) {
        console.error(verse.error.message);
        return null;
    }

    return {
        title: `Sura ${verse.data.chapter_number}, ${verse.data.ws_quran_chapters.title_english} (${verse.data.ws_quran_chapters.title_transliterated})`,
        body: `[${verse.data.verse_id}] ${verse.data.ws_quran_text.english}`,
        category: 'RANDOM_VERSE',
        threadId: 'random-verse',
        deepLink: `wikisubmission://verse/${verse.data.verse_id}`,
        expirationHours: 5,
        metadata: {
            chapter_number: verse.data.chapter_number,
            verse_id: verse.data.verse_id,
        },
    };
}