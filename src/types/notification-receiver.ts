export interface NotificationReceiver {
    device_token: string;
    platform: 'ios';
    last_notification_sent_at: string;
    prayer_notifications: boolean;
    daily_verse_notifications: boolean;
    daily_chapter_notifications: boolean;
}