export interface NotificationContent {
    title: string;
    body: string;
    category: 'DAILY_VERSE' | 'DAILY_CHAPTER' | 'PRAYER_TIMES' | 'RANDOM_VERSE';
    threadId: 'daily-verse' | 'daily-chapter' | 'prayer' | 'random-verse';
    expirationHours: number;
    deepLink: `wikisubmission://${string}`;
    custom?: Record<string, any>;
}