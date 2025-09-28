import { sendIOSNotification } from "../../utils/send-ios-notification";
import { WikiSubmission } from "wikisubmission-sdk";
import { WRoute } from "../../types/w-route";

export default function route(): WRoute { 
    return { 
        url: "/random-verse",
        method: "POST",
        cache: { 
            duration: 15,
            durationType: "seconds",
        },
        handler: async (request, reply) => {
            const { device_token } = request.body as { device_token: string };

            if (!device_token) {
                return reply.status(400).send({ error: "device_token is required in request body" });
            }

            const ws = WikiSubmission.Quran.V1.createAPIClient();
            const verse = await ws.getRandomVerse();

            if (verse instanceof Error) {
                return reply.status(500).send({ error: verse.message });
            }

            if (verse.response.length === 0) {
                return reply.status(500).send({ error: "No verse found" });
            }

            try {
                const result = await sendIOSNotification({
                    deviceToken: device_token,
                    title: `Sura ${verse.response[0]?.chapter_number}, ${verse.response[0]?.chapter_title_english} (${verse.response[0]?.chapter_title_transliterated})`,
                    body: `[${verse.response[0]?.verse_id}] ${verse.response[0]?.verse_text_english}`,
                    category: "RANDOM_VERSE_NOTIFICATION",
                    threadId: "random-verse",
                    deepLink: `wikisubmission://verse/${verse.response[0]?.verse_id}`,
                    custom: {
                        verse_id: verse.response[0]?.verse_id,
                    },
                });

                return reply.send({
                    success: true,
                    verse: verse.response[0],
                    notification_result: result
                });
            } catch (error) {
                return reply.status(500).send({ error: error instanceof Error ? error.message : String(error) });
            }
        },
    }
}