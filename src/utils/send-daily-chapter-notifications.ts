import type { Notification } from "../types/notification";
import { generateDailyChapterNotification } from "../notification-generators/daily-chapter";
import { sendIOSNotification } from "./send-ios-notification";

export async function sendDailyChapterNotifications(receiver: Notification) {

    if (!receiver.device_token) return;

    const dailyChapter = await generateDailyChapterNotification(receiver);

    if (dailyChapter) {
        try {
            await sendIOSNotification(receiver.device_token, dailyChapter);
        } catch (error) {
            console.error(`Error sending daily chapter notification to ${receiver.device_token}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
