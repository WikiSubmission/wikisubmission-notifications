export interface NotificationPreferences<T extends { [key: string]: any } = {}> {
    enabled: boolean;
    customization: T;
}