import { WikiSubmission } from "wikisubmission-sdk";
import type { NotificationContent } from "../types/notification-content";

export async function generateRandomVerseNotification(): Promise<NotificationContent | null> { 

    const ws = WikiSubmission.Quran.V1.createAPIClient();
    const verse = await ws.getRandomVerse();

    if (verse instanceof Error) {
        console.error(verse.message);
        return null;
    }

    return {
        title: `Sura ${verse.response[0]?.chapter_number}, ${verse.response[0]?.chapter_title_english} (${verse.response[0]?.chapter_title_transliterated})`,
        body: `[${verse.response[0]?.verse_id}] ${verse.response[0]?.verse_text_english}`,
        category: 'RANDOM_VERSE',
        threadId: 'random-verse',
        deepLink: `wikisubmission://verse/${verse.response[0]?.verse_id}`,
        expirationHours: 5,
        custom: {
            verse_id: verse.response[0]?.verse_id,
        },
    };
}