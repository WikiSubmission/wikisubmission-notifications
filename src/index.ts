import dotenv from 'dotenv';
import { getReceivers } from "./utils/get-receivers";
import { sendPrayerTimesNotifications } from "./utils/send-prayer-times-notifications";
import { sendDailyVerseNotifications } from './utils/send-daily-verse-notifications';
import { sendDailyChapterNotifications } from './utils/send-daily-chapter-notifications';

(async () => {
    dotenv.config();

    const handlePrayerNotifications = async () => {
        try {
            const receivers = await getReceivers();

            for (const receiver of receivers.filter(receiver => receiver.platform === 'ios')) {
                if (receiver.prayer_notifications && receiver.device_token) {
                    await sendPrayerTimesNotifications(receiver);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDailyVerseNotifications = async () => {
        try {
            const receivers = await getReceivers();

            for (const receiver of receivers.filter(receiver => receiver.platform === 'ios')) {
                if (receiver.daily_verse_notifications && receiver.device_token) {
                    await sendDailyVerseNotifications(receiver);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDailyChapterNotifications = async () => {
        try {
            const receivers = await getReceivers();

            for (const receiver of receivers.filter(receiver => receiver.platform === 'ios')) {
                if (receiver.daily_chapter_notifications && receiver.device_token) {
                    await sendDailyChapterNotifications(receiver);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    try {
        console.log('Running initial notifications...');
        await handlePrayerNotifications();
        await handleDailyVerseNotifications();
        await handleDailyChapterNotifications();

        console.log('Setting up recurring intervals...');
        setInterval(() => {
            handlePrayerNotifications().catch(err => 
                console.error('Unhandled error in prayer notifications interval:', err)
            );
        }, 60000); // 1 minute
        
        setInterval(() => {
            handleDailyVerseNotifications().catch(err => 
                console.error('Unhandled error in daily verse notifications interval:', err)
            );
        }, 1000 * 60 * 60 * 1); // 1 hours
        
        setInterval(() => {
            handleDailyChapterNotifications().catch(err => 
                console.error('Unhandled error in daily chapter notifications interval:', err)
            );
        }, 1000 * 60 * 60 * 3); // 3 hours
        
        console.log('✅ WikiSubmission Notifications Service is running');
    } catch (error) {
        console.error('Startup error:', error);
        process.exit(1);
    }
})();