import type { Notification } from "../types/notification";
import { generateDailyVerseNotification } from "../notification-generators/generate-daily-verse";
import { sendIOSNotification } from "./send-ios-notification";

export async function sendDailyVerseNotifications(receiver: Notification) {

    if (!receiver.device_token) return;

    const dailyVerse = await generateDailyVerseNotification(receiver);

    if (dailyVerse) {
        try {
            await sendIOSNotification(receiver.device_token, dailyVerse);
        } catch (error) {
            console.error(`Error sending daily verse notification to ${receiver.device_token}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
