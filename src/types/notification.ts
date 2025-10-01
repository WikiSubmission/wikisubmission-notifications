import { NotificationPreferences } from "./notification-preferences";

// Main DB - 'ws-notifications'
export interface Notification {
    id?: string;  // - auto-generated
    created_at?: string; // - auto-generated
    platform?: 'ios';
    device_token?: string;
    user_id?: string;
    last_delivery_at?: string;
    prayer_time_notifications?: NotificationPreferences<{
        location?: string;
        fajr?: boolean;
        dhuhr?: boolean;
        asr?: boolean;
        maghrib?: boolean;
        isha?: boolean;
        use_midpoint_method_for_asr?: boolean;
    }>;
    daily_verse_notifications?: NotificationPreferences;
    daily_chapter_notifications?: NotificationPreferences;
}