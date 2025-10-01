export interface NotificationPreferences<T extends { [key: string]: any } = {}> {
    enabled: boolean;
    last_delivery_at: string;
    customization: T;
}