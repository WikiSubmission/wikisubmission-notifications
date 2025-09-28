import dotenv from 'dotenv';
import { getReceivers } from "./utils/get-receivers";
import { sendPrayerTimesNotifications } from "./utils/send-prayer-times-notifications";
import { sendDailyVerseNotifications } from './utils/send-daily-verse-notifications copy';
import { sendDailyChapterNotifications } from './utils/send-daily-chapter-notifications';

(async () => {
    dotenv.config();

    const handlePrayerNotifications = async () => {
        const receivers = await getReceivers();

        for (const receiver of receivers.filter(receiver => receiver.platform === 'ios')) {
            if (receiver.prayer_notifications && receiver.device_token) {
                await sendPrayerTimesNotifications(receiver);
            }
        }
    };

    const handleDailyVerseNotifications = async () => {
        const receivers = await getReceivers();

        for (const receiver of receivers.filter(receiver => receiver.platform === 'ios')) {
            if (receiver.daily_verse_notifications && receiver.device_token) {
                await sendDailyVerseNotifications(receiver);
            }
        }
    };

    const handleDailyChapterNotifications = async () => {
        const receivers = await getReceivers();

        for (const receiver of receivers.filter(receiver => receiver.platform === 'ios')) {
            if (receiver.daily_verse_notifications && receiver.device_token) {
                await sendDailyChapterNotifications(receiver);
            }
        }
    };

    try {
        // Run on start.
        await handlePrayerNotifications();
        await handleDailyChapterNotifications();
        await handleDailyVerseNotifications();

        // Recurring intervals.
        setInterval(handlePrayerNotifications, 60000); // 1 minute
        setInterval(handleDailyVerseNotifications, 1000 * 60 * 60 * 3); // 3 hours
        setInterval(handleDailyChapterNotifications, 1000 * 60 * 60 * 5); // 4 hours
    } catch (error) {
        console.error(`Unhandled error:`, error);
    }
})();