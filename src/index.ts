import dotenv from 'dotenv';
import { NotificationReceivers } from "./notification-receivers";
import { sendPrayerTimesNotifications } from "./utils/send-prayer-times-notifications";
import { sendDailyVerseNotifications } from './utils/send-daily-verse-notifications';
import { sendDailyChapterNotifications } from './utils/send-daily-chapter-notifications';
import { Server } from './api/server';

(async () => {
    dotenv.config();

    const notificationReceivers = NotificationReceivers.instance;

    const handlePrayerNotifications = async () => {
        try {
            const receivers = await notificationReceivers.getReceivers();

            for (const receiver of receivers.filter(receiver => receiver.platform === 'ios')) {
                if (receiver.prayer_time_notifications && receiver.device_token) {
                    await sendPrayerTimesNotifications(receiver);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDailyVerseNotifications = async () => {
        try {
            const receivers = await notificationReceivers.getReceivers();

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
            const receivers = await notificationReceivers.getReceivers();

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
        console.log('Initializing notification receivers...');
        await notificationReceivers.initialize();
        await notificationReceivers.subscribeToChanges();

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
        
        console.log('✅ Notifications Service is running');

        const server = new Server();
        await server.start();

        console.log('✅ API server running');

        // Graceful shutdown handling
        const gracefulShutdown = async () => {
            console.log('Shutting down gracefully...');
            await notificationReceivers.shutdown();
            await server.stop();
            process.exit(0);
        };

        process.on('SIGINT', gracefulShutdown);
        process.on('SIGTERM', gracefulShutdown);

    } catch (error) {
        console.error('Startup error:', error);
        process.exit(1);
    }
})();