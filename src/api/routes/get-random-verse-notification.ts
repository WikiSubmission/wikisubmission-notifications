import { RouteOptions } from "fastify";
import { sendIOSNotification } from "../../utils/send-ios-notification";
import { WikiSubmission } from "wikisubmission-sdk";

export default function route(): RouteOptions { 
    return { 
        url: "/random-verse-notification/:device_token",
        method: "GET",
        handler: async (request, reply) => {
            const { device_token } = request.params as { device_token: string };

            const ws = WikiSubmission.Quran.V1.createAPIClient();
            const verse = await ws.getRandomVerse();

            if (verse instanceof Error) {
                return reply.status(500).send({ error: verse.message });
            }

            if (verse.response.length === 0) {
                return reply.status(500).send({ error: "No verse found" });
            }

            const verseData = verse.response[0];

            if (!verseData) {
                return reply.status(500).send({ error: "No verse found" });
            }

            await sendIOSNotification({
                deviceToken: device_token,
                title: "Random Verse",
                body: `[${verseData.verse_id}] ${verseData.verse_text_english}`,
                category: "RANDOM_VERSE_NOTIFICATION",
                threadId: "random-verse",
                deepLink: `wikisubmission://verse/${verseData.verse_id}`,
                custom: {
                    verse_id: verseData.verse_id,
                },
            })
        },
    }
}