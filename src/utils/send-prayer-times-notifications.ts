import type { Notification } from "../types/notification";
import { generatePrayerTimesNotification } from "../notification-generators/generate-prayer-times";
import { sendIOSNotification } from "./send-ios-notification";

export async function sendPrayerTimesNotifications(receiver: Notification) {

    if (!receiver.device_token) return;

    const prayerTimes = await generatePrayerTimesNotification(receiver);

    if (prayerTimes) {
        try {
            await sendIOSNotification(receiver.device_token, prayerTimes, {
                critical: true
            });
        } catch (error) {
            console.error(`Error sending prayer times notification to ${receiver.device_token}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}